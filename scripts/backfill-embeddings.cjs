/* eslint-disable @typescript-eslint/no-require-imports */
// Backfill semantic-search embeddings for existing rows.
//
// Run with:  node scripts/backfill-embeddings.cjs
//            node scripts/backfill-embeddings.cjs --force
//
// Requires JINA_API_KEY in .env. By default it finds every business that has at
// least one product or FAQ with no embedding, then re-embeds that business's
// whole catalogue. With --force it re-embeds every row regardless of whether a
// vector already exists (e.g. after changing the embedding model or task type),
// using the same embedText() the app uses, so the endpoint and model can never
// drift between this script and the server.

require("dotenv/config");

const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// lib/embeddings.ts has no path-alias imports, so Node's native TypeScript
// support can load it directly, even from this CommonJS script. Loaded lazily
// and cached because `import()` is async and CommonJS has no top-level await.
let embeddingsModule = null;

function getEmbeddings() {
  if (!embeddingsModule) {
    const embeddingsPath = pathToFileURL(
      path.join(__dirname, "..", "lib", "embeddings.ts"),
    ).href;
    embeddingsModule = import(embeddingsPath);
  }

  return embeddingsModule;
}

async function reembedProduct(productId) {
  const { embedText, toVectorLiteral } = await getEmbeddings();

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, description: true },
  });

  if (!product) {
    return;
  }

  const text = [product.name, product.description]
    .filter((part) => Boolean(part && part.trim()))
    .join("\n");
  const vector = await embedText(text);

  await prisma.$executeRawUnsafe(
    'UPDATE "Product" SET "embedding" = $1::vector WHERE "id" = $2',
    toVectorLiteral(vector),
    productId,
  );
}

async function reembedFAQ(faqId) {
  const { embedText, toVectorLiteral } = await getEmbeddings();

  const faq = await prisma.faq.findUnique({
    where: { id: faqId },
    select: { id: true, question: true, answer: true, category: true },
  });

  if (!faq) {
    return;
  }

  const text = [faq.question, faq.answer, faq.category]
    .filter((part) => Boolean(part && part.trim()))
    .join("\n");
  const vector = await embedText(text);

  await prisma.$executeRawUnsafe(
    'UPDATE "Faq" SET "embedding" = $1::vector WHERE "id" = $2',
    toVectorLiteral(vector),
    faqId,
  );
}

async function reembedAll(businessId) {
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

async function main() {
  const force = process.argv.includes("--force");

  if (!process.env.JINA_API_KEY) {
    throw new Error(
      "JINA_API_KEY is not set. Add it to your .env file before backfilling.",
    );
  }

  if (force) {
    console.log("Force mode: re-embedding ALL rows");
  }

  // Businesses to visit: only those missing a vector, unless --force, in which
  // case every business with any product or FAQ.
  const missingFilter = force ? "" : ' WHERE "embedding" IS NULL';

  const businesses = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT "businessId" FROM (
       SELECT "businessId" FROM "Product"${missingFilter}
       UNION
       SELECT "businessId" FROM "Faq"${missingFilter}
     ) AS missing`,
  );

  console.log(
    force
      ? `Found ${businesses.length} business(es) to re-embed (all rows).`
      : `Found ${businesses.length} business(es) with unembedded products or FAQs.`,
  );

  let totalProducts = 0;
  let totalFaqs = 0;

  for (const { businessId } of businesses) {
    console.log(`Business ${businessId}: re-embedding...`);
    const { products, faqs } = await reembedAll(businessId);
    totalProducts += products;
    totalFaqs += faqs;
    console.log(`  done: ${products} product(s), ${faqs} FAQ(s)`);
  }

  console.log(
    `Backfill complete: ${totalProducts} product(s) and ${totalFaqs} FAQ(s) across ${businesses.length} business(es).`,
  );
}

main()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
