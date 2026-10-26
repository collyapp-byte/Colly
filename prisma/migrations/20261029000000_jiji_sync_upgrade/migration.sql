-- Jiji sync upgrade: remember where a product came from so the sync job can
-- match live listings back to a catalogue row, and stamp each business's shop
-- plus the last successful sync (the dashboard auto-sync reads that stamp).
ALTER TABLE "Product" ADD COLUMN "externalSource" TEXT;
ALTER TABLE "Product" ADD COLUMN "externalId" TEXT;
ALTER TABLE "Business" ADD COLUMN "lastJijiSyncAt" TIMESTAMP(3);
-- Not in the original brief: without the shop URL the sync job has nothing to
-- fetch, so the importer saves the storefront the catalogue came from.
ALTER TABLE "Business" ADD COLUMN "jijiShopUrl" TEXT;
