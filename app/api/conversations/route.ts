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

// GET /api/conversations?limit=50&cursor=...
// The signed-in business's most recently active conversations, with the related
// customer and the single most recent message on each row. Keyset paginated:
// pass `nextCursor` back as `cursor` for the following page.
export async function GET(request: Request) {
  try {
    const businessId = await getCurrentBusinessId();

    if (!businessId) {
      return unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const limit = readPageSize(searchParams);
    const cursor = decodeCursor(searchParams.get("cursor"));
    const cursorLastMessageAt = cursorDate(cursor, "lastMessageAt");
    const cursorCreatedAt = cursorDate(cursor, "createdAt");
    const cursorId = cursor?.id ?? null;

    // Continue strictly after the last row of the previous page. The three-way
    // OR mirrors the (lastMessageAt, createdAt, id) ordering exactly, including
    // rows that share a timestamp.
    const after =
      cursorLastMessageAt && cursorCreatedAt && cursorId
        ? {
            OR: [
              { lastMessageAt: { lt: cursorLastMessageAt } },
              {
                lastMessageAt: cursorLastMessageAt,
                createdAt: { lt: cursorCreatedAt },
              },
              {
                lastMessageAt: cursorLastMessageAt,
                createdAt: cursorCreatedAt,
                id: { lt: cursorId },
              },
            ],
          }
        : {};

    // Ordered and paginated in Postgres. `lastMessageAt` is a denormalised stamp
    // of the conversation's newest message (a Message-insert trigger keeps it in
    // sync, see prisma/migrations/20261026000000_qa_indexes), so the
    // (businessId, lastMessageAt) index serves the inbox ordering directly
    // instead of loading every conversation and sorting them in memory.
    const rows = await prisma.conversation.findMany({
      where: { businessId, ...after },
      orderBy: [
        { lastMessageAt: "desc" },
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: limit,
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

    const lastRow = rows.at(-1);
    const nextCursor =
      rows.length === limit && lastRow
        ? encodeCursor({
            lastMessageAt: lastRow.lastMessageAt,
            createdAt: lastRow.createdAt,
            id: lastRow.id,
          })
        : null;

    return Response.json({ conversations, nextCursor });
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
