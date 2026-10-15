import { prisma } from "@/lib/prisma";
import { getCurrentBusinessId } from "@/lib/auth";

type MessageRequestBody = {
  content?: unknown;
};

function unauthorized() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}

function notFound() {
  return Response.json({ error: "Conversation not found" }, { status: 404 });
}

// POST /api/conversations/[id]/messages
// An agent (a human on the team) replies in a conversation they have taken
// over. The row is stored with sender "agent" so the UI can render it as the
// business's own voice, separate from the AI's replies.
export async function POST(
  request: Request,
  context: RouteContext<"/api/conversations/[id]/messages">,
) {
  try {
    const businessId = await getCurrentBusinessId();

    if (!businessId) {
      return unauthorized();
    }

    const { id } = await context.params;

    const body = (await request.json()) as MessageRequestBody;
    const content = typeof body.content === "string" ? body.content.trim() : "";

    if (!content) {
      return Response.json(
        { error: "Message content is required" },
        { status: 400 },
      );
    }

    // Scoped by businessId so another tenant's conversation reads as not found.
    const conversation = await prisma.conversation.findFirst({
      where: { id, businessId },
      select: { id: true },
    });

    if (!conversation) {
      return notFound();
    }

    const message = await prisma.message.create({
      data: {
        businessId,
        conversationId: conversation.id,
        sender: "agent",
        content,
      },
    });

    return Response.json(
      {
        message: {
          id: message.id,
          sender: message.sender,
          content: message.content,
          createdAt: message.createdAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[POST /api/conversations/[id]/messages]", error);
    return Response.json(
      {
        error: "Failed to send message",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
