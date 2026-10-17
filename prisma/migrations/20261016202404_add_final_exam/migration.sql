-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "finalExamPassedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AgentFinalExamQuestion" (
    "id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "sectionTitle" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctIndex" INTEGER NOT NULL,
    "explanation" TEXT,

    CONSTRAINT "AgentFinalExamQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentFinalExamAttempt" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "answers" JSONB NOT NULL,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentFinalExamAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentFinalExamQuestion_order_idx" ON "AgentFinalExamQuestion"("order");

-- CreateIndex
CREATE INDEX "AgentFinalExamAttempt_agentId_attemptedAt_idx" ON "AgentFinalExamAttempt"("agentId", "attemptedAt");

-- AddForeignKey
ALTER TABLE "AgentFinalExamAttempt" ADD CONSTRAINT "AgentFinalExamAttempt_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
