-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "referredByAgentId" TEXT;

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "agentNumber" TEXT NOT NULL,
    "supabaseUserId" TEXT,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "certifiedAt" TIMESTAMP(3),

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentCourse" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentLesson" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "bodyMarkdown" TEXT NOT NULL,
    "youtubeUrl" TEXT,
    "durationMin" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentLesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentLessonProgress" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentLessonProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentQuizQuestion" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "question" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctIndex" INTEGER NOT NULL,

    CONSTRAINT "AgentQuizQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentQuizAttempt" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "answers" JSONB NOT NULL,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentQuizAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentCertificate" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "certificateId" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Agent_agentNumber_key" ON "Agent"("agentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_supabaseUserId_key" ON "Agent"("supabaseUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_email_key" ON "Agent"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AgentCourse_slug_key" ON "AgentCourse"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "AgentLesson_courseId_slug_key" ON "AgentLesson"("courseId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "AgentLessonProgress_agentId_lessonId_key" ON "AgentLessonProgress"("agentId", "lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentCertificate_agentId_key" ON "AgentCertificate"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentCertificate_certificateId_key" ON "AgentCertificate"("certificateId");

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_referredByAgentId_fkey" FOREIGN KEY ("referredByAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentLesson" ADD CONSTRAINT "AgentLesson_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "AgentCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentLessonProgress" ADD CONSTRAINT "AgentLessonProgress_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentLessonProgress" ADD CONSTRAINT "AgentLessonProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "AgentLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentQuizQuestion" ADD CONSTRAINT "AgentQuizQuestion_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "AgentCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentQuizAttempt" ADD CONSTRAINT "AgentQuizAttempt_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentQuizAttempt" ADD CONSTRAINT "AgentQuizAttempt_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "AgentCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentCertificate" ADD CONSTRAINT "AgentCertificate_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
