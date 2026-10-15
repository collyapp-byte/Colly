-- pgvector must exist before the vector columns can be created. The extension
-- is also enabled once via scripts/enable-pgvector.cjs; IF NOT EXISTS keeps this
-- migration idempotent and lets fresh/shadow databases apply it too.
CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable
ALTER TABLE "Faq" ADD COLUMN     "embedding" vector(384);

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "embedding" vector(384);
