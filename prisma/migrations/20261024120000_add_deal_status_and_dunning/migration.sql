-- `dealStatus` is also added by `20261024120000_add_customer_deal_status`.
-- Both directories share the same timestamp, so Prisma applies them back to
-- back and a plain ALTER would abort `prisma migrate deploy` with 42701
-- ("column dealStatus already exists") on any database built from scratch.
-- `IF NOT EXISTS` is a no-op on the production database, where both of these
-- columns already exist, and makes a fresh clone / staging restore succeed.
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "dealStatus" TEXT NOT NULL DEFAULT 'INQUIRY';
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "paymentFailedAt" TIMESTAMP WITH TIME ZONE;
