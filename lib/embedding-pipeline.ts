import { prisma } from "@/lib/prisma";
import { embedText, toVectorLiteral } from "@/lib/embeddings";

// Keeping embeddings fresh.
//
// The `embedding` columns are `Unsupported("vector(1024)")` in the Prisma schema,
// so Prisma Client neither reads nor writes them. We build the embedding text
// here, ask Jina to embed it, then write the vector with raw SQL.
//
// Products have no category column (only a name + description), so their text
// is just those two fields; FAQs also include their category.

/** Build the exact string that represents a product in embedding space. */
function buildProductText(product: {
  name: string;
  description: string | null;
}): string {
  return [product.name, product.description]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join("\n");
}

/** Build the exact string that represents an FAQ in embedding space. */
function buildFaqText(faq: {
  question: string;
  answer: string;
  category: string | null;
}): string {
  return [faq.question, faq.answer, faq.category]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join("\n");
}

/**
 * Re-embed one product and store the vector.
 *
 * Safe to call fire-and-forget after create/update; throws on failure so the
 * caller can decide whether to log or ignore.
 */
export async function reembedProduct(productId: string): Promise<void> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, description: true },
  });

  if (!product) {
    throw new Error(`Cannot embed product ${productId}: not found`);
  }

  const text = buildProductText(product);
  const vector = await embedText(text);
  const literal = toVectorLiteral(vector);

  await prisma.$executeRaw`
    UPDATE "Product"
    SET "embedding" = ${literal}::vector
    WHERE "id" = ${productId}
  `;
}

/**
 * Re-embed one FAQ and store the vector.
 *
 * Safe to call fire-and-forget after create/update.
 */
export async function reembedFAQ(faqId: string): Promise<void> {
  const faq = await prisma.faq.findUnique({
    where: { id: faqId },
    select: { id: true, question: true, answer: true, category: true },
  });

  if (!faq) {
    throw new Error(`Cannot embed FAQ ${faqId}: not found`);
  }

  const text = buildFaqText(faq);
  const vector = await embedText(text);
  const literal = toVectorLiteral(vector);

  await prisma.$executeRaw`
    UPDATE "Faq"
    SET "embedding" = ${literal}::vector
    WHERE "id" = ${faqId}
  `;
}

/**
 * Backfill: re-embed every product and FAQ belonging to a business.
 *
 * Runs sequentially on purpose — the Jina endpoint rate-limits
 * bursts. Returns how many rows were processed.
 */
export async function reembedAll(
  businessId: string,
): Promise<{ products: number; faqs: number }> {
  const products = await prisma.product.findMany({
    where: { businessId },
    select: { id: true },
  });

  for (const product of products) {
    await reembedProduct(product.id);
  }

  const faqs = await prisma.faq.findMany({
    where: { businessId },
    select: { id: true },
  });

  for (const faq of faqs) {
    await reembedFAQ(faq.id);
  }

  return { products: products.length, faqs: faqs.length };
}
