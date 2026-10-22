-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "aiMessagesUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "manualMessagesUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "selectedPlan" TEXT,
ADD COLUMN     "trialEndsAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "WhatsappWaitlist" (
    "id" TEXT NOT NULL,
    "whatsappNumber" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsappWaitlist_pkey" PRIMARY KEY ("id")
);
