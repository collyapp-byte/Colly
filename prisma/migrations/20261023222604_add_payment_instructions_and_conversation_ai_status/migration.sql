-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "paymentInstructions" TEXT;

-- AlterTable
ALTER TABLE "Conversation" ALTER COLUMN "status" SET DEFAULT 'AI_HANDLING';
