ALTER TABLE "Business" ADD COLUMN "planCredits" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Business" ADD COLUMN "topUpCredits" INTEGER NOT NULL DEFAULT 0;
UPDATE "Business" SET "topUpCredits" = "creditBalance";
ALTER TABLE "Business" DROP COLUMN "creditBalance";
