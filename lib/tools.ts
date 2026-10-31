import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { embedText, toVectorLiteral } from "@/lib/embeddings";
import { translatePidgin } from "@/lib/pidgin-translate";
import { debugLog } from "@/lib/logger";
import {
  generateInvoiceNumber,
  koboToNaira,
  nairaToKobo,
  RECEIPT_INVOICE_NOTE,
  type InvoiceItem,
} from "@/lib/invoices";
import { sendReceiptAlert } from "@/lib/owner-alerts";
import {
  bookingEndTime,
  MAX_BOOKING_SERVICE_LENGTH,
  normalizeBookingDate,
  normalizeBookingTime,
  parseBookingSlot,
} from "@/lib/bookings";
import { formatInLagosTimezone } from "@/lib/timezone";

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

  debugLog(`[search] Pidgin translated: "${query}" → "${translated}"`);

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

// ---------------------------------------------------------------------------
// Receipt-to-invoice
// ---------------------------------------------------------------------------

/**
 * Ceiling for a receipt-generated invoice, in kobo (₦10,000,000). It matches
 * the cap on in-chat Paystack links: an OCR misread that turns ₦25,000 into
 * ₦25,000,000 must fail loudly rather than create a nonsense invoice.
 */
const MAX_RECEIPT_AMOUNT_KOBO = 10_000_000 * 100;

/** Longest line description we store from the model. */
const MAX_RECEIPT_DESCRIPTION_LENGTH = 500;

/** Longest customer name we store in the owner alert. */
const MAX_RECEIPT_NAME_LENGTH = 120;

/**
 * Whether `value` is a public object URL in Colly's own Supabase Storage bucket.
 *
 * The image pipeline only ever fetches URLs shaped like this (see
 * `isTrustedStorageUrl` in `app/api/chat/route.ts`), and the owner clicks the
 * receipt link from the dashboard, so a model-supplied "receipt" URL from
 * customer text must never be stored: it could point anywhere on the web.
 */
function isStorageUrl(value: string): boolean {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!projectUrl) {
    return false;
  }

  try {
    const url = new URL(value);

    if (url.protocol !== "https:") return false;
    if (url.username || url.password) return false;
    if (url.port && url.port !== "443") return false;
    if (!url.pathname.startsWith("/storage/v1/object/public/")) return false;

    return (
      url.hostname.toLowerCase() === new URL(projectUrl).hostname.toLowerCase()
    );
  } catch {
    return false;
  }
}

/**
 * What `generateInvoiceFromReceipt` hands back to the model, and therefore to
 * the customer's chat turn.
 */
export type ReceiptInvoiceResult =
  | {
      created: true;
      invoiceId: string;
      invoiceNumber: string;
      /** Always "draft" for a new invoice: only the owner can approve it. */
      status: string;
      /** The receipt total in integer kobo. */
      totalKobo: number;
      /** True when this picture had already been turned into an invoice. */
      duplicate: boolean;
    }
  | { created: false; error: string };

/**
 * Creates a DRAFT invoice from a payment receipt the customer sent in chat.
 *
 * The AI extracts the amount, sender and description; this function owns the
 * database write so the assistant can never mark an invoice as paid:
 *
 * - the status is always "draft" (the owner verifies the picture and approves),
 * - the total is computed in integer kobo from the Naira amount,
 * - VAT is 0, because the receipt total already includes whatever tax was
 *   charged — adding 7.5% on top would invoice more than the customer paid,
 * - the customer is the one on the conversation (found by its chat session id),
 * - the picture the customer sent is stored on the invoice as `receiptUrl` so
 *   the owner can see exactly what was sent (a public object in Colly's own
 *   Storage bucket only — never a URL the model or the customer typed),
 * - a receipt picture already invoiced in this business is not invoiced twice.
 *
 * The owner is alerted on Telegram. Never throws for a business rule failure:
 * the caller gets `{ created: false, error }`, which is returned to the model.
 */
export async function generateInvoiceFromReceipt(args: {
  businessId: string;
  conversationId: string;
  customerName: string;
  amountNaira: number;
  description: string;
  receiptUrl: string;
}): Promise<ReceiptInvoiceResult> {
  const amountKobo = nairaToKobo(args.amountNaira);

  if (!Number.isFinite(args.amountNaira) || amountKobo <= 0) {
    return {
      created: false,
      error: "The receipt amount must be a positive number of Naira.",
    };
  }

  if (amountKobo > MAX_RECEIPT_AMOUNT_KOBO) {
    return {
      created: false,
      error: "That receipt amount is too large to turn into an invoice.",
    };
  }

  const receiptUrl = args.receiptUrl.trim();
  if (!isStorageUrl(receiptUrl)) {
    return {
      created: false,
      error: "The customer's receipt picture is missing or is not a valid link.",
    };
  }


  const conversation = await prisma.conversation.findFirst({
    where: { id: args.conversationId, businessId: args.businessId },
    select: {
      customerId: true,
      customer: { select: { id: true, name: true } },
    },
  });

  if (!conversation) {
    return {
      created: false,
      error: "No active conversation to attach this invoice to.",
    };
  }

  const customer = conversation.customer;

  // The same picture may reach the tool twice (a model retry, a redelivered
  // webhook). Returning the existing draft keeps one invoice per receipt.
  const existing = await prisma.invoice.findFirst({
    where: { businessId: args.businessId, receiptUrl },
    select: { id: true, invoiceNumber: true, status: true, total: true },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    return {
      created: true,
      invoiceId: existing.id,
      invoiceNumber: existing.invoiceNumber,
      status: existing.status,
      totalKobo: nairaToKobo(Number(existing.total)),
      duplicate: true,
    };
  }

  const description =
    args.description.trim().slice(0, MAX_RECEIPT_DESCRIPTION_LENGTH) ||
    "Payment received";
  const customerName =
    args.customerName.trim().slice(0, MAX_RECEIPT_NAME_LENGTH) ||
    customer.name;

  const totalNaira = koboToNaira(amountKobo);
  const item: InvoiceItem = {
    name: description,
    quantity: 1,
    unitPrice: totalNaira,
    total: totalNaira,
  };

  try {
    // Two attempts: `generateInvoiceNumber` reads the last number, so an owner
    // creating an invoice at the same moment can win the race and trip the
    // (businessId, invoiceNumber) unique constraint.
    let invoice: {
      id: string;
      invoiceNumber: string;
      status: string;
    } | null = null;

    for (let attempt = 0; attempt < 2 && !invoice; attempt++) {
      try {
        invoice = await prisma.invoice.create({
          data: {
            businessId: args.businessId,
            customerId: customer.id,
            invoiceNumber: await generateInvoiceNumber(args.businessId),
            // Crucial: the AI cannot mark an invoice as paid.
            status: "draft",
            subtotal: totalNaira,
            vat: 0,
            total: totalNaira,
            items: [item],
            notes: RECEIPT_INVOICE_NOTE,
            receiptUrl,
          },
          select: { id: true, invoiceNumber: true, status: true },
        });
      } catch (error) {
        const isNumberClash =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002";

        if (!isNumberClash || attempt === 1) {
          throw error;
        }
      }
    }

    if (!invoice) {
      return { created: false, error: "Could not create the draft invoice." };
    }

    await sendReceiptAlert({
      businessId: args.businessId,
      customerName,
      amountKobo,
    });

    return {
      created: true,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      totalKobo: amountKobo,
      duplicate: false,
    };
  } catch (error) {
    console.error(
      "[tools] generate_invoice_from_receipt failed for business",
      args.businessId,
      error instanceof Error ? error.message : error,
    );
    return { created: false, error: "Could not create the draft invoice." };
  }
}


// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

/**
 * What `createBooking` hands back to the model, and therefore to the customer's
 * chat turn. Mirrors `ReceiptInvoiceResult`: a business-rule failure is a
 * `created: false` result (the model asks for the missing detail), never a
 * throw, so a bad date cannot take the customer's reply down with it.
 */
export type BookingResult =
  | {
      created: true;
      bookingId: string;
      customerName: string;
      serviceName: string;
      /** The slot normalised to Lagos `YYYY-MM-DD` and `HH:MM`. */
      date: string;
      time: string;
      /** The same slot as Lagos renders it, e.g. "Thursday, 5 November 2026 at 14:00". */
      startTimeLagos: string;
      /** Always PENDING for a new appointment: only my boss/oga confirms it. */
      status: string;
      /** True when this customer already had this slot on the books. */
      duplicate: boolean;
      /** One line the model can say back to the customer. */
      message: string;
    }
  | { created: false; error: string };

/**
 * Books an appointment for the customer on the current conversation.
 *
 * The AI collects the service, date and time; this function owns the write:
 *
 * - the customer is the one on the conversation (checked against `businessId`,
 *   so a guessed id can never book for another tenant's customer),
 * - the slot is parsed through `parseBookingSlot()`, i.e. a zone-less wall clock
 *   is read as **Lagos** time — the same instant on a UTC server and on a Lagos
 *   laptop — and an impossible day (`2026-02-31`) is refused,
 * - a slot in the past is refused: the model must ask for another day,
 * - `status` is left to the schema default (`PENDING`); the assistant can never
 *   confirm its own appointment, that stays with my boss/oga in the dashboard,
 * - the slot is one hour long (`bookingEndTime`),
 * - the same customer + service + instant is not booked twice (a model retry or
 *   a redelivered webhook must not create two appointments).
 */
export async function createBooking(args: {
  businessId: string;
  customerId: string;
  serviceName: string;
  date: string;
  time: string;
}): Promise<BookingResult> {
  const serviceName = args.serviceName
    .trim()
    .slice(0, MAX_BOOKING_SERVICE_LENGTH);

  if (!serviceName) {
    return {
      created: false,
      error:
        "The appointment needs a service: ask the customer what they want to book.",
    };
  }

  const date = normalizeBookingDate(args.date);
  const time = normalizeBookingTime(args.time);
  const startTime = parseBookingSlot(args.date, args.time);
  if (!date || !time || !startTime) {
    return {
      created: false,
      error:
        "That date or time could not be read. Ask the customer for the day (YYYY-MM-DD) and the time (HH:MM, Lagos time) again.",
    };
  }

  if (startTime.getTime() < Date.now()) {
    return {
      created: false,
      error: `That slot (${args.date} ${args.time}) is in the past. Ask the customer for a future date and time.`,
    };
  }

  const customer = await prisma.customer.findFirst({
    where: { id: args.customerId, businessId: args.businessId },
    select: { id: true, name: true, phone: true },
  });

  if (!customer) {
    return {
      created: false,
      error: "There is no customer on this conversation to book for.",
    };
  }

  // The model's strings are canonicalised, so "2026-11-5" and "2pm" are stored
  // and echoed back as "2026-11-05" and "14:00".
  const startTimeLagos = formatInLagosTimezone(startTime);
  const customerName = customer.name || customer.phone;

  try {
    const existing = await prisma.booking.findFirst({
      where: {
        businessId: args.businessId,
        customerId: customer.id,
        serviceName,
        startTime,
        status: { not: "CANCELLED" },
      },
      select: { id: true, status: true },
    });

    if (existing) {
      return {
        created: true,
        bookingId: existing.id,
        customerName,
        serviceName,
        date,
        time,
        startTimeLagos,
        status: existing.status,
        duplicate: true,
        message: `Booking already exists for ${customerName} on ${date} at ${time}.`,
      };
    }

    const booking = await prisma.booking.create({
      data: {
        businessId: args.businessId,
        customerId: customer.id,
        serviceName,
        startTime,
        endTime: bookingEndTime(startTime),
        // status stays at the schema default: PENDING.
      },
      select: { id: true, status: true },
    });

    return {
      created: true,
      bookingId: booking.id,
      customerName,
      serviceName,
      date,
      time,
      startTimeLagos,
      status: booking.status,
      duplicate: false,
      message: `Booking created for ${customerName} on ${date} at ${time}`,
    };
  } catch (error) {
    console.error(
      "[tools] create_booking failed for business",
      args.businessId,
      error instanceof Error ? error.message : error,
    );
    return {
      created: false,
      error:
        "Could not save the appointment. Ask the customer to try again in a moment.",
    };
  }
}

