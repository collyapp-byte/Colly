CREATE TABLE "WhatsappWaitlist" (
    "id" TEXT NOT NULL,
    "businessId" TEXT,
    "whatsappNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsappWaitlist_pkey" PRIMARY KEY ("id")
);
