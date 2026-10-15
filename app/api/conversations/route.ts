import { prisma } from "@/lib/prisma";
import { getCurrentBusinessId } from "@/lib/auth";

function unauthorized() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}

// GET /api/conversations
// Lists the signed-in business's conversations, most recent activity first,
// with the related customer and the single most recent message on each row.
export async function GET() {
  try {
    const businessId = await getCurrentBusinessId();

    if (!businessId) {
      return unauthorized();
    }

    // A one-to-many relation can't be ordered by its children directly, so we
    // pull the latest message per conversation and sort in memory.
    const rows = await prisma.conversation.findMany({
      where: { businessId },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    const conversations = rows
      .map((row) => ({
        row,
        lastActivityAt: (row.messages[0]?.createdAt ?? row.createdAt).getTime(),
      }))
      .sort((a, b) => b.lastActivityAt - a.lastActivityAt)
      .map(({ row }) => {
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
