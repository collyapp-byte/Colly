import { prisma } from "@/lib/prisma";
import { getCurrentBusinessId } from "@/lib/auth";
import {
  cursorDate,
  decodeCursor,
  encodeCursor,
  readPageSize,
} from "@/lib/pagination";

function unauthorized() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}

// GET /api/customers?limit=50&cursor=...
// The signed-in business's customers, newest first and keyset paginated, each
// with a conversation count and the timestamp of their latest message. The page
// itself is then ranked by recent activity.
export async function GET(request: Request) {
  try {
    const businessId = await getCurrentBusinessId();

    if (!businessId) {
      return unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const limit = readPageSize(searchParams);
    const cursor = decodeCursor(searchParams.get("cursor"));
    const cursorCreatedAt = cursorDate(cursor, "createdAt");
    const cursorId = cursor?.id ?? null;

    const after =
      cursorCreatedAt && cursorId
        ? {
            OR: [
              { createdAt: { lt: cursorCreatedAt } },
              { createdAt: cursorCreatedAt, id: { lt: cursorId } },
            ],
          }
        : {};

    // A customer's "last active" time is the newest message in any of their
    // conversations, which Prisma cannot order a parent by. So the page is
    // fetched newest-first (a newly added customer is always on page one) and
    // ranked by activity in memory; the cursor continues from the last row's
    // createdAt/id, so paging is stable even though the ranking is per page.
    const rows = await prisma.customer.findMany({
      where: { businessId, ...after },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
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

    const lastRow = rows.at(-1);
    const nextCursor =
      rows.length === limit && lastRow
        ? encodeCursor({ createdAt: lastRow.createdAt, id: lastRow.id })
        : null;

    return Response.json({ customers, nextCursor });
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
