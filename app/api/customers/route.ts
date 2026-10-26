import { prisma } from "@/lib/prisma";
import { getCurrentBusinessId } from "@/lib/auth";

function unauthorized() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}

/** Rows per page for the list endpoints; see the note on pagination in GET. */
const LIST_PAGE_SIZE = 50;

// GET /api/customers
// The signed-in business's customers (one page), ranked by recent activity, each
// with a conversation count and the timestamp of their latest message.
export async function GET() {
  try {
    const businessId = await getCurrentBusinessId();

    if (!businessId) {
      return unauthorized();
    }

    // A customer's "last active" time is the newest message in any of their
    // conversations, which Prisma cannot order a parent by, so one page of
    // customers is fetched (newest first, so a newly added customer is always in
    // it) and ranked by activity in memory. Cursor pagination is the follow-up.
    const rows = await prisma.customer.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      take: LIST_PAGE_SIZE,
      include: {
        conversations: {
          select: {
            createdAt: true,
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { createdAt: true },
            },
          },
        },
      },
    });

    const customers = rows
      .map((row) => {
        const lastMessageAt = row.conversations.reduce<Date | null>(
          (latest, conversation) => {
            const at = conversation.messages[0]?.createdAt ?? null;
            if (!at) return latest;
            return !latest || at > latest ? at : latest;
          },
          null,
        );

        return { row, lastMessageAt };
      })
      // Customers with no messages yet fall back to their created date so they
      // still get a sensible position, below anyone with real activity.
      .sort((a, b) => {
        const aTime = (a.lastMessageAt ?? a.row.createdAt).getTime();
        const bTime = (b.lastMessageAt ?? b.row.createdAt).getTime();
        return bTime - aTime;
      })
      .map(({ row, lastMessageAt }) => ({
        id: row.id,
        businessId: row.businessId,
        name: row.name,
        phone: row.phone,
        tags: row.tags,
        dealStatus: row.dealStatus,
        totalSpent: row.totalSpent,
        createdAt: row.createdAt,
        lastContactedAt: row.lastContactedAt,
        conversationCount: row.conversations.length,
        lastMessageAt,
      }));

    return Response.json({ customers });
  } catch (error) {
    console.error("[GET /api/customers]", error);
    return Response.json(
      {
        error: "Failed to load customers",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
