-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "address" TEXT,
ADD COLUMN     "businessHours" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "tone" TEXT NOT NULL DEFAULT 'friendly';
