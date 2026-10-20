-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "bankAccountName" TEXT,
ADD COLUMN     "bankAccountNumber" TEXT,
ADD COLUMN     "bankCode" TEXT,
ADD COLUMN     "commissionBalanceNaira" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "paystackRecipientCode" TEXT;

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "commissionEndsAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AgentPayout" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "amountNaira" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reference" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentPayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentPayout_reference_key" ON "AgentPayout"("reference");

-- CreateIndex
CREATE INDEX "AgentPayout_agentId_createdAt_idx" ON "AgentPayout"("agentId", "createdAt");

-- AddForeignKey
ALTER TABLE "AgentPayout" ADD CONSTRAINT "AgentPayout_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
