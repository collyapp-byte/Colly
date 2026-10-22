-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "lastContactedAt" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "totalSpent" DOUBLE PRECISION NOT NULL DEFAULT 0;
