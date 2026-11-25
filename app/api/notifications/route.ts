import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

function unauthorized() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}

// GET /api/notifications
// Returns the unread escalation count for the signed-in business.
// Used by the header bell and dashboard shell for live refresh without full reload.
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    const unreadCount = await prisma.conversation.count({
      where: {
        businessId: user.businessId,
        escalatedAt: { not: null },
        status: { not: "CLOSED" },
      },
    });

    return Response.json({ unreadCount });
  } catch (error) {
    console.error("[GET /api/notifications]", error);
    return Response.json({ error: "Failed to fetch notifications count" }, { status: 500 });
  }
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
