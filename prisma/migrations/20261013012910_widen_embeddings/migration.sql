-- Widen the pgvector embedding columns from 384 to 1024 dimensions to match
-- jina-embeddings-v3's native output width.
--
-- Existing 384-dimension vectors cannot be cast to 1024 dimensions, and they are
-- stale anyway (the embedding model/task changed), so this discards them with
-- `USING NULL`. Every product and FAQ must then be re-embedded:
--   node scripts/backfill-embeddings.cjs --force
--
-- NOTE: the FAQ table is named "Faq" (renamed from "FAQ" in migration
-- 20261012111307_rename_faq_model).

ALTER TABLE "Product" ALTER COLUMN "embedding" TYPE vector(1024) USING NULL;
ALTER TABLE "Faq" ALTER COLUMN "embedding" TYPE vector(1024) USING NULL;
