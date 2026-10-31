-- Team Collaboration: staff members invited by a business owner.
--
-- A "TeamMember" row is the tenant link for a staff account, exactly as a "User"
-- row is for the owner: the signed-in Supabase account is matched to one of
-- these by email (lib/auth.ts#loadTenant) and gets the row's "businessId" back.
-- "email" is unique across the table because the session lookup is by email
-- alone, so one address belongs to exactly one business. Deleting the business
-- removes its staff rows (ON DELETE CASCADE).
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STAFF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_email_key" ON "TeamMember"("email");

-- CreateIndex
CREATE INDEX "TeamMember_businessId_idx" ON "TeamMember"("businessId");

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
