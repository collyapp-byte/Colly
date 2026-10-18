-- AlterTable
ALTER TABLE "Business" DROP COLUMN "creditsBalance",
ADD COLUMN     "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
ADD COLUMN     "creditWalletBalanceNaira" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "telegramBotToken" TEXT,
ADD COLUMN     "telegramChatId" TEXT;
