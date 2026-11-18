-- WhatsApp session state for the Baileys adapter (lib/whatsapp-session.ts).
--
-- Written to be re-runnable, like every migration in this repo: `npm run build`
-- runs `prisma migrate deploy` on every release, and a database that was
-- patched by hand (or a migration replayed after a manual `db execute`) must
-- not abort the build. Postgres has no `CREATE TYPE IF NOT EXISTS`, so the enum
-- is created inside a DO block and the table/indexes use IF NOT EXISTS.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SessionStatus') THEN
    CREATE TYPE "SessionStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'QR_READY', 'CONNECTING');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "WhatsAppSession" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "phoneNumber" TEXT,
    "qrCode" TEXT,
    "creds" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppSession_businessId_key" ON "WhatsAppSession"("businessId");
CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppSession_phoneNumber_key" ON "WhatsAppSession"("phoneNumber");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WhatsAppSession_businessId_fkey'
  ) THEN
    ALTER TABLE "WhatsAppSession"
      ADD CONSTRAINT "WhatsAppSession_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
