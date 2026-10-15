-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "negotiationState" JSONB;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "floorPrice" DECIMAL(10,2),
ADD COLUMN     "negotiable" BOOLEAN NOT NULL DEFAULT true;
