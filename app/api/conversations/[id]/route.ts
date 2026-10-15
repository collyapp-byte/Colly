import { prisma } from "@/lib/prisma";
import { getCurrentBusinessId } from "@/lib/auth";

function unauthorized() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}

// GET /api/conversations/[id]
// A single conversation with its customer and every message (oldest -> newest).
export async function GET(
  _request: Request,
  context: RouteContext<"/api/conversations/[id]">,
) {
  try {
    const businessId = await getCurrentBusinessId();

    if (!businessId) {
      return unauthorized();
    }

    const { id } = await context.params;

    // Scoped by businessId so another tenant's conversation reads as not found.
    const conversation = await prisma.conversation.findFirst({
      where: { id, businessId },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!conversation) {
      return Response.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
    }

    const { messages, ...meta } = conversation;

    return Response.json({
      conversation: meta,
      messages: messages.map((message) => ({
        id: message.id,
        sender: message.sender,
        content: message.content,
        createdAt: message.createdAt,
      })),
    });
  } catch (error) {
    console.error("[GET /api/conversations/[id]]", error);
    return Response.json(
      {
        error: "Failed to load conversation",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
