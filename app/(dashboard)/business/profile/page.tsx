import { connection } from "next/server";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isTone } from "@/lib/business";
import { BusinessProfileEditor } from "@/components/business/business-profile-editor";

/**
 * /business/profile — the business profile is edited inline here instead of
 * redirecting the owner to /settings. `PATCH /api/business` already accepts
 * name, phone, tone, businessHours, address and description (each validated
 * as a string, trimmed, stored as null when empty), so no API or schema
 * change was needed: the editor posts straight to that route and calls
 * `router.refresh()` on save so /business and this page re-sync with Prisma.
 */
export default async function BusinessProfilePage() {
  await connection();
  const user = await requireAuth();

  const business = await prisma.business.findUnique({
    where: { id: user.businessId },
  });

  if (!business) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <BusinessProfileEditor
        id={business.id}
        name={business.name}
        phone={business.phone}
        businessHours={business.businessHours ?? null}
        address={business.address ?? null}
        description={business.description ?? null}
        tone={isTone(business.tone) ? business.tone : "friendly"}
        isOwner={user.role === "OWNER"}
      />
    </div>
  );
}