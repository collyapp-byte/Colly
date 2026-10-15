/* eslint-disable @typescript-eslint/no-require-imports */
// Enable the pgvector extension on the Supabase Postgres database.
//
// Run once with:  node scripts/enable-pgvector.cjs
//
// Extensions are database-level objects, not Prisma models, so this cannot be
// expressed as a Prisma migration. We run the DDL through Prisma's raw query
// API using the same DATABASE_URL the app uses.

require("dotenv/config");

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  console.log("Enabling pgvector extension...");
  await prisma.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS vector;");

  const rows = await prisma.$queryRawUnsafe(
    "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';",
  );
  console.log("pgvector is enabled:", rows);
}

main()
  .catch((error) => {
    console.error("Failed to enable pgvector:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
