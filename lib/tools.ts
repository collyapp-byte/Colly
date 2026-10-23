import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { embedText, toVectorLiteral } from "@/lib/embeddings";
import { translatePidgin } from "@/lib/pidgin-translate";

/**
 * A product exactly as the AI should see it: plain JSON, with the Prisma
 * `Decimal` price already converted to a JavaScript number so it can be handed
 * straight to the model (and formatted as Naira without any weird string maths).
 */
export type ProductMatch = {
  id: string;
  name: string;
  price: number;
  stock: number | null;
  description: string | null;
  /**
   * Public URL of the product's picture (the first entry of the product's
   * image list), or null when the product has no photo. The assistant hands
   * this to the customer as a picture instead of escalating to the owner.
   */
  imageUrl: string | null;
  /**
   * How confident we are that this is the product the customer asked for.
   * "exact" means a strong semantic match that also shares a model-specific
   * token; "fuzzy" means a keyword fallback hit or a weak/family-only semantic
   * neighbour (e.g. an A15 returned for a request for an S24 Ultra). Only
   * `searchProducts` sets this; alternatives from `findSimilarProducts` omit it.
   */
  confidence?: "exact" | "fuzzy";
};

/**
 * An FAQ exactly as the AI should see it: plain JSON with just the fields the
 * model needs to answer policy, delivery, payment and similar questions.
 */
export type FaqMatch = {
  id: string;
  question: string;
  answer: string;
  category: string | null;
};

/** How many rows we hand back to the model (the "top 5 matches"). */
const MAX_RESULTS = 5;

/**
 * Cosine similarity (1 - cosine distance) a row must beat to count as a
 * semantic match. Below this the "match" is usually noise, and it's better to
 * fall back to keyword search. Kept deliberately low (0.20) because jina-embeddings-v3
 * scores short queries against long passages only in the ~0.2-0.3 range — even a
 * literal "tv" against the matching product is ~0.24 — so a higher bar discards
 * genuine matches.
 */
const SIMILARITY_THRESHOLD = 0.20;

/**
 * Similarity above which a semantic match may count as an "exact" match. Below
 * this the result is only a rough semantic neighbour, so it is labelled
 * "fuzzy" and the model is told to treat it as not having the product.
 */
const EXACT_SIMILARITY_THRESHOLD = 0.30;

/** How many alternatives to suggest by default. */
const ALTERNATIVE_LIMIT = 3;

/**
 * Upper bound on the rows we pull out of Postgres before ranking them in
 * memory, for the keyword fallback. The catalogue is small per business, so
 * this is only a guard rail.
 */
const MAX_CANDIDATES = 50;

/**
 * Filler words that show up in almost every customer question ("how much is the
 * ...", "do you have ..."). They carry no product signal, so dropping them stops
 * them from matching half the catalogue. Used only by the keyword fallback.
 */
const STOP_WORDS = new Set([
  "about", "and", "any", "are", "available", "can", "cost", "dey", "do",
  "does", "for", "from", "get", "has", "have", "hello", "hi", "how", "in",
  "is", "it", "its", "me", "much", "my", "of", "on", "please", "price",
  "the", "this", "to", "want", "we", "what", "which", "with", "you", "your",
]);

/**
 * Brand and product-family words that carry no model information. Two products
 * can both say "Samsung Galaxy" and still be completely different models, so
 * these are ignored when deciding whether a query names *this* product. Used to
 * keep a request for an "S24 Ultra" from matching an "A15" on the brand alone.
 */
const BRAND_TOKENS = new Set([
  "samsung", "galaxy", "apple", "iphone", "ipad", "ipod", "macbook", "imac",
  "hisense", "tecno", "infinix", "itel", "nokia", "oppo", "xiaomi", "redmi",
  "realme", "google", "pixel", "huawei", "sony", "lg", "panasonic", "philips",
  "hp", "dell", "lenovo", "asus", "acer", "toshiba", "msi", "canon", "nikon",
  "epson", "oraimo", "anker", "jbl", "beats", "bose", "haier", "thermocool",
  "polystar", "century", "syinix", "binatone", "scanfrost", "midea",
]);

/** Split a free-text query into unique, lower-cased search terms. */
function tokenize(query: string): string[] {
  const terms = new Set<string>();

  for (const word of query.toLowerCase().split(/[^a-z0-9]+/)) {
    if (word.length < 2 || STOP_WORDS.has(word)) {
      continue;
    }

    terms.add(word);
  }

  return [...terms];
}

/**
 * The model-specific terms in `text`: the tokens that actually identify a
 * product, with brands/families (Samsung, Galaxy, ...) stripped out. A query
 * made only of brand words yields an empty list.
 */
function modelTokens(text: string): string[] {
  return tokenize(text).filter((term) => !BRAND_TOKENS.has(term));
}

/**
 * Label a semantic match "exact" only when it is both strong and shares a
 * model-specific token with the query. A high-scoring match on the brand alone
 * (e.g. an A15 for an "S24 Ultra" query) is still "fuzzy".
 */
function classifyMatch(
  query: string,
  productName: string,
  similarity: number,
): "exact" | "fuzzy" {
  if (similarity <= EXACT_SIMILARITY_THRESHOLD) {
    return "fuzzy";
  }

  const queryModelTokens = modelTokens(query);
  if (queryModelTokens.length === 0) {
    return "exact";
  }

  const productTokens = new Set(tokenize(productName));
  return queryModelTokens.some((term) => productTokens.has(term))
    ? "exact"
    : "fuzzy";
}

// ---------------------------------------------------------------------------
// Semantic search (pgvector)
//
// The `embedding` columns are `Unsupported("vector(1024)")`, so Prisma Client
// can't select or order by them. We embed the query and let Postgres rank by
// cosine distance (`<=>`) in raw SQL.
// ---------------------------------------------------------------------------

/** A semantic product match that still carries its cosine similarity. */
type ScoredProductMatch = ProductMatch & { similarity: number };

/** Row shape returned by the product semantic query. */
type ProductVectorRow = {
  id: string;
  name: string;
  price: Prisma.Decimal;
  stock: number | null;
  description: string | null;
  images: string[] | null;
  similarity: number;
};

/** Row shape returned by the FAQ semantic query. */
type FaqVectorRow = {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  similarity: number;
};

/**
 * Embed `query` and return the closest product rows, most similar first.
 *
 * Rows whose cosine similarity is at or below `SIMILARITY_THRESHOLD` are
 * dropped. Throws if embedding or the query fails, so the caller can fall back
 * to keyword search.
 */
async function semanticSearchProducts(
  businessId: string,
  query: string,
): Promise<ScoredProductMatch[]> {
  const literal = toVectorLiteral(await embedText(query, "retrieval.query"));

  const rows = await prisma.$queryRaw<ProductVectorRow[]>`
    SELECT "id", "name", "price", "stock", "description", "images",
           1 - ("embedding" <=> ${literal}::vector) AS "similarity"
    FROM "Product"
    WHERE "businessId" = ${businessId} AND "embedding" IS NOT NULL
    ORDER BY "embedding" <=> ${literal}::vector
    LIMIT ${MAX_RESULTS}
  `;

  return rows
    .filter((row) => row.similarity > SIMILARITY_THRESHOLD)
    .map((row) => ({
      id: row.id,
      name: row.name,
      price: Number(row.price),
      stock: row.stock,
      description: row.description,
      imageUrl: row.images?.[0] ?? null,
      similarity: row.similarity,
    }));
}

/**
 * Like `semanticSearchProducts` but tuned for alternatives: no similarity
 * threshold and a caller-supplied limit, so we always return the closest
 * products we have even when there is little or no keyword overlap.
 */
async function semanticFindSimilarProducts(
  businessId: string,
  query: string,
  limit: number,
): Promise<ProductMatch[]> {
  const literal = toVectorLiteral(await embedText(query, "retrieval.query"));

  const rows = await prisma.$queryRaw<ProductVectorRow[]>`
    SELECT "id", "name", "price", "stock", "description", "images",
           1 - ("embedding" <=> ${literal}::vector) AS "similarity"
    FROM "Product"
    WHERE "businessId" = ${businessId} AND "embedding" IS NOT NULL
    ORDER BY "embedding" <=> ${literal}::vector
    LIMIT ${limit}
  `;

  // No threshold: alternatives are useful even at a low score, so we take the
  // closest `limit` products the business has.
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    price: Number(row.price),
    stock: row.stock,
    description: row.description,
    imageUrl: row.images?.[0] ?? null,
  }));
}

/**
 * Embed `query` and return the closest FAQ rows, most similar first.
 *
 * Same shape and threshold behaviour as `semanticSearchProducts`.
 */
async function semanticSearchFAQs(
  businessId: string,
  query: string,
): Promise<FaqMatch[]> {
  const literal = toVectorLiteral(await embedText(query, "retrieval.query"));

  const rows = await prisma.$queryRaw<FaqVectorRow[]>`
    SELECT "id", "question", "answer", "category",
           1 - ("embedding" <=> ${literal}::vector) AS "similarity"
    FROM "Faq"
    WHERE "businessId" = ${businessId} AND "embedding" IS NOT NULL
    ORDER BY "embedding" <=> ${literal}::vector
    LIMIT ${MAX_RESULTS}
  `;

  return rows
    .filter((row) => row.similarity > SIMILARITY_THRESHOLD)
    .map((row) => ({
      id: row.id,
      question: row.question,
      answer: row.answer,
      category: row.category,
    }));
}

// ---------------------------------------------------------------------------
// Pidgin pre-translation + multi-text embedding
// ---------------------------------------------------------------------------

/** Count whitespace-separated words in `text`. */
function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Turn a raw customer query into the text(s) we embed for semantic search.
 *
 * 1. Translate Nigerian Pidgin to English (lib/pidgin-translate.ts), because
 *    the embedding model only reliably handles Pidgin when an English product
 *    word anchors it.
 * 2. When the translation differs but is very short (1-2 words), also embed the
 *    ORIGINAL query and merge results, so a product literally named with the
 *    original phrase (e.g. a "big screen TV") still matches.
 *
 * Returns `[query]` untouched when there is nothing to translate.
 */
function buildEmbeddingTexts(query: string): string[] {
  const translated = translatePidgin(query);

  if (translated === query) {
    return [query];
  }

  console.log(`[search] Pidgin translated: "${query}" → "${translated}"`);

  const texts = [translated];

  if (wordCount(translated) <= 2) {
    texts.push(query);
  }

  return texts;
}

/**
 * Semantic product search over several query texts, merged in order and
 * de-duplicated by id, capped at `MAX_RESULTS`.
 */
async function semanticSearchProductsMerged(
  businessId: string,
  texts: string[],
): Promise<ScoredProductMatch[]> {
  const matches: ScoredProductMatch[] = [];
  const seen = new Set<string>();

  for (const text of texts) {
    const found = await semanticSearchProducts(businessId, text);

    for (const match of found) {
      if (!seen.has(match.id)) {
        seen.add(match.id);
        matches.push(match);
      }
    }
  }

  return matches.slice(0, MAX_RESULTS);
}

/**
 * Semantic FAQ search over several query texts, merged like
 * `semanticSearchProductsMerged`.
 */
async function semanticSearchFAQsMerged(
  businessId: string,
  texts: string[],
): Promise<FaqMatch[]> {
  const matches: FaqMatch[] = [];
  const seen = new Set<string>();

  for (const text of texts) {
    const found = await semanticSearchFAQs(businessId, text);

    for (const match of found) {
      if (!seen.has(match.id)) {
        seen.add(match.id);
        matches.push(match);
      }
    }
  }

  return matches.slice(0, MAX_RESULTS);
}

// ---------------------------------------------------------------------------
// Keyword search (fallback)
// ---------------------------------------------------------------------------

/**
 * Keyword fall back used when semantic search is unavailable or returns
 * nothing: Postgres filters the business's catalogue by ANY of the query terms
 * (case-insensitive `contains` on name/description), then we rank candidates
 * here by how many terms they match.
 */
async function keywordSearchProducts(
  businessId: string,
  query: string,
): Promise<ProductMatch[]> {
  const terms = tokenize(query);

  if (terms.length === 0) {
    return [];
  }

  // Match ANY term against the name or the description.
  const termFilters: Prisma.ProductWhereInput[] = [];

  for (const term of terms) {
    termFilters.push({ name: { contains: term, mode: "insensitive" } });
    termFilters.push({ description: { contains: term, mode: "insensitive" } });
  }

  const candidates = await prisma.product.findMany({
    where: { businessId, OR: termFilters },
    take: MAX_CANDIDATES,
  });

  // When the query names a specific model ("S24 Ultra"), a candidate has to
  // mention one of those model tokens. This stops a brand-only overlap
  // ("Samsung Galaxy") from matching a different model ("A15").
  const queryModelTokens = modelTokens(query);

  return candidates
    .map((product) => {
      const haystack = `${product.name} ${product.description ?? ""}`.toLowerCase();
      const score = terms.reduce(
        (total, term) => total + (haystack.includes(term) ? 1 : 0),
        0,
      );

      return { product, haystack, score };
    })
    .filter(({ haystack }) =>
      queryModelTokens.length === 0
        ? true
        : queryModelTokens.some((term) => haystack.includes(term)),
    )
    .sort(
      (a, b) =>
        b.score - a.score || a.product.name.localeCompare(b.product.name),
    )
    .slice(0, MAX_RESULTS)
    .map(({ product }) => ({
      id: product.id,
      name: product.name,
      price: Number(product.price),
      stock: product.stock,
      description: product.description,
      imageUrl: product.images?.[0] ?? null,
      // Keyword hits are never an exact guarantee of the requested model.
      confidence: "fuzzy" as const,
    }));
}

/**
 * Keyword fall back for FAQs: same shape as `keywordSearchProducts`, matching
 * ANY query term against the question or answer.
 */
async function keywordSearchFAQs(
  businessId: string,
  query: string,
): Promise<FaqMatch[]> {
  const terms = tokenize(query);

  if (terms.length === 0) {
    return [];
  }

  // Match ANY term against the question or the answer.
  const termFilters: Prisma.FaqWhereInput[] = [];

  for (const term of terms) {
    termFilters.push({ question: { contains: term, mode: "insensitive" } });
    termFilters.push({ answer: { contains: term, mode: "insensitive" } });
  }

  const candidates = await prisma.faq.findMany({
    where: { businessId, OR: termFilters },
    take: MAX_CANDIDATES,
  });

  return candidates
    .map((faq) => {
      const haystack = `${faq.question} ${faq.answer}`.toLowerCase();
      const score = terms.reduce(
        (total, term) => total + (haystack.includes(term) ? 1 : 0),
        0,
      );

      return { faq, score };
    })
    .sort(
      (a, b) =>
        b.score - a.score || a.faq.question.localeCompare(b.faq.question),
    )
    .slice(0, MAX_RESULTS)
    .map(({ faq }) => ({
      id: faq.id,
      question: faq.question,
      answer: faq.answer,
      category: faq.category,
    }));
}

// ---------------------------------------------------------------------------
// Trigram typo fallback
// ---------------------------------------------------------------------------

type TrigramProductRow = {
  id: string;
  name: string;
  price: Prisma.Decimal;
  stock: number | null;
  description: string | null;
  imageUrl: string | null;
  similarity: number;
};

/**
 * Typo-tolerant fallback powered by Postgres `pg_trgm`. Handles misspellings
 * like "ipone" / "samsng" that neither embeddings nor `contains` reliably
 * catch. If the extension is unavailable the query throws and this returns an
 * empty list so the caller can use the plain keyword fallback.
 */
async function trigramSearchProducts(
  businessId: string,
  query: string,
): Promise<ProductMatch[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const like = `%${trimmed}%`;

  try {
    const rows = await prisma.$queryRaw<TrigramProductRow[]>`
      SELECT "id", "name", "price", "stock", "description",
             CASE WHEN array_length("images", 1) >= 1 THEN "images"[1] ELSE NULL END AS "imageUrl",
             similarity("name", ${trimmed}) AS "similarity"
      FROM "Product"
      WHERE "businessId" = ${businessId}
        AND (
          similarity("name", ${trimmed}) > 0.3
          OR "name" ILIKE ${like}
          OR "description" ILIKE ${like}
        )
      ORDER BY "similarity" DESC, "name" ASC
      LIMIT ${MAX_RESULTS}
    `;

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      price: Number(row.price),
      stock: row.stock,
      description: row.description,
      imageUrl: row.imageUrl,
      confidence: "fuzzy" as const,
    }));
  } catch (error) {
    console.warn(
      "[search] trigram product search unavailable, using keyword fallback:",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Search a business's product catalogue for the products that best match
 * `query`.
 *
 * Semantic (embedding) search runs first so phrasing like "the big screen wey dey
 * your shop" finds the right TV. If the embedding call fails (no API key, network
 * error) or finds nothing above the similarity threshold, we fall back to
 * keyword matching so chat search keeps working.
 *
 * Returns at most 5 matches, and an empty array when nothing matches. Each
 * match carries a `confidence` of "exact" (strong semantic match that shares a
 * model-specific token with the query) or "fuzzy" (a weak/family-only semantic
 * neighbour, or a keyword fallback hit). The model is told to treat "fuzzy" as
 * not having the requested product and to suggest alternatives instead. Every
 * match also carries the product's `imageUrl` when it has a picture, so the
 * assistant can send the picture to the customer.
 */
export async function searchProducts(
  businessId: string,
  query: string,
): Promise<ProductMatch[]> {
  const texts = buildEmbeddingTexts(query);

  try {
    const matches = await semanticSearchProductsMerged(businessId, texts);

    if (matches.length > 0) {
      return matches.map(({ similarity, ...product }) => ({
        ...product,
        confidence: classifyMatch(query, product.name, similarity),
      }));
    }
  } catch (error) {
    console.warn(
      "[search] semantic product search unavailable, using keyword fallback:",
      error instanceof Error ? error.message : error,
    );
  }

  const trigramMatches = await trigramSearchProducts(businessId, query);
  if (trigramMatches.length > 0) {
    return trigramMatches;
  }

  return keywordSearchProducts(businessId, query);
}

/**
 * Find the closest alternative products to `query`, for when the customer asks
 * for something we don't stock.
 *
 * Uses the same embedding + cosine similarity approach as `searchProducts` but
 * with no similarity threshold and no keyword fallback: it always returns the
 * closest products the business has, even when there is little or no keyword
 * overlap. If products are not embedded yet (or the embedding call fails) it
 * falls back to the catalogue itself, so a business with products always gets
 * at least one suggestion. Returns at most `limit` matches (default 3).
 */
export async function findSimilarProducts(
  businessId: string,
  query: string,
  limit = ALTERNATIVE_LIMIT,
): Promise<ProductMatch[]> {
  const texts = buildEmbeddingTexts(query);
  const matches: ProductMatch[] = [];
  const seen = new Set<string>();

  try {
    for (const text of texts) {
      const found = await semanticFindSimilarProducts(businessId, text, limit);

      for (const match of found) {
        if (!seen.has(match.id)) {
          seen.add(match.id);
          matches.push(match);
        }
      }
    }
  } catch (error) {
    console.warn(
      "[search] semantic alternative search unavailable:",
      error instanceof Error ? error.message : error,
    );
  }

  if (matches.length > 0) {
    return matches.slice(0, limit);
  }

  // No embedded products yet, or the embedding call failed: the customer still
  // needs alternatives, so return real catalogue items rather than nothing.
  try {
    const fallback = await prisma.product.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return fallback.map((product) => ({
      id: product.id,
      name: product.name,
      price: Number(product.price),
      stock: product.stock,
      description: product.description,
      imageUrl: product.images?.[0] ?? null,
    }));
  } catch (error) {
    console.warn(
      "[search] alternative catalogue fallback unavailable:",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

/**
 * Search a business's FAQ knowledge base for the entries that best match
 * `query`, with the same semantic-first, keyword-fallback behaviour as
 * `searchProducts`.
 *
 * Returns at most 5 matches, and an empty array when nothing matches.
 */
export async function searchFAQs(
  businessId: string,
  query: string,
): Promise<FaqMatch[]> {
  const texts = buildEmbeddingTexts(query);

  try {
    const matches = await semanticSearchFAQsMerged(businessId, texts);

    if (matches.length > 0) {
      return matches;
    }
  } catch (error) {
    console.warn(
      "[search] semantic FAQ search unavailable, using keyword fallback:",
      error instanceof Error ? error.message : error,
    );
  }

  return keywordSearchFAQs(businessId, query);
}
