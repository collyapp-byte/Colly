export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

function unauthorized() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}

// PATCH /api/notifications
// Marks every notification for the caller's business as read by stamping
// `business.lastNotificationsReadAt`. Clears the header bell dot and the home
// top banner. Safe to call repeatedly.
export async function PATCH() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    await prisma.business.update({
      where: { id: user.businessId },
      data: { lastNotificationsReadAt: new Date() },
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error("[PATCH /api/notifications]", error);
    return Response.json(
      { error: "Failed to mark notifications as read" },
      { status: 500 },
    );
  }
}
