-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "ownerTelegramChatId" TEXT;

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "escalatedAt" TIMESTAMP(3);
