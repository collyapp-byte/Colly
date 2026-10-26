import { prisma } from "@/lib/prisma";
import { getCurrentBusinessId } from "@/lib/auth";

function unauthorized() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}

/**
 * Rows per page for the dashboard list endpoints. One page is all the inbox
 * renders today; a `cursor` becomes necessary once these lists grow a "load
 * more" control.
 */
const LIST_PAGE_SIZE = 50;

// GET /api/conversations
// The signed-in business's most recently active conversations (one page), with
// the related customer and the single most recent message on each row.
export async function GET() {
  try {
    const businessId = await getCurrentBusinessId();

    if (!businessId) {
      return unauthorized();
    }

    // Ordered and paginated in Postgres. `lastMessageAt` is a denormalised stamp
    // of the conversation's newest message (a Message-insert trigger keeps it in
    // sync, see prisma/migrations/20261026000000_qa_indexes), so the
    // (businessId, lastMessageAt) index serves the inbox ordering directly
    // instead of loading every conversation and sorting them in memory.
    const rows = await prisma.conversation.findMany({
      where: { businessId },
      orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
      take: LIST_PAGE_SIZE,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    const conversations = rows.map((row) => {
      const last = row.messages[0] ?? null;

      return {
        id: row.id,
        status: row.status,
        createdAt: row.createdAt,
        customer: row.customer,
        lastMessage: last
          ? {
              content: last.content,
              sender: last.sender,
              createdAt: last.createdAt,
            }
          : null,
      };
    });

    return Response.json({ conversations });
  } catch (error) {
    console.error("[GET /api/conversations]", error);
    return Response.json(
      {
        error: "Failed to load conversations",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
