-- DropForeignKey
ALTER TABLE "Sale" DROP CONSTRAINT "Sale_productId_fkey";

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "nrsExemptReason" TEXT,
ADD COLUMN     "nrsLastDismissedAt" TIMESTAMP(3),
ADD COLUMN     "nrsRegistrationDate" TIMESTAMP(3),
ADD COLUMN     "nrsTaxId" TEXT,
ADD COLUMN     "nrsTier" TEXT;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "customLabel" TEXT,
ALTER COLUMN "productId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
