-- AlterTable
ALTER TABLE "AgentCourse" ADD COLUMN     "isCertificationCourse" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "paymentMethod" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "name" TEXT;
