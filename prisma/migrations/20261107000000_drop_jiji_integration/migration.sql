-- Drop the Jiji marketplace integration.
--
-- `20261029000000_jiji_sync_upgrade` added these four columns for the catalogue
-- importer and its two-way sync. The importer, the sync route and the dashboard
-- card are gone, so nothing reads or writes them any more:
--
--   Product.externalSource / Product.externalId  - provenance of an imported
--     row ("JIJI" + the listing id), used by the sync to match a live advert
--     back to the product it had created.
--   Business.jijiShopUrl / Business.lastJijiSyncAt - the shop to re-read and
--     the stamp behind the once-a-day lazy refresh.
--
-- `IF EXISTS` keeps this re-runnable against a database that was patched by
-- hand (the add-* migrations in this repo are applied that way).

ALTER TABLE "Product" DROP COLUMN IF EXISTS "externalSource";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "externalId";
ALTER TABLE "Business" DROP COLUMN IF EXISTS "jijiShopUrl";
ALTER TABLE "Business" DROP COLUMN IF EXISTS "lastJijiSyncAt";
