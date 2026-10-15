-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "audioDuration" INTEGER,
ADD COLUMN     "audioUrl" TEXT,
ADD COLUMN     "messageType" TEXT NOT NULL DEFAULT 'text',
ADD COLUMN     "transcript" TEXT;
