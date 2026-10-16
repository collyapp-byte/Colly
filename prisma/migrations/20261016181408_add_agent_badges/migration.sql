-- CreateTable
CREATE TABLE "AgentBadge" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "courseSlug" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentBadge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentBadge_agentId_idx" ON "AgentBadge"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentBadge_agentId_courseSlug_key" ON "AgentBadge"("agentId", "courseSlug");

-- AddForeignKey
ALTER TABLE "AgentBadge" ADD CONSTRAINT "AgentBadge_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
