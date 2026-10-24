import { prisma } from "@/lib/prisma";
import { getCurrentBusinessId } from "@/lib/auth";

// How long a takeover lasts before the AI picks the conversation back up on its
// own. An agent who is still working can re-take, or resume early with DELETE.
const TAKEOVER_MINUTES = 60;

function unauthorized() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}

function notFound() {
  return Response.json({ error: "Conversation not found" }, { status: 404 });
}

// POST /api/conversations/[id]/takeover
// Pauses the AI for this conversation: a human agent is replying now, so the
// chat route must stop generating answers until `pausedUntil` passes.
export async function POST(
  _request: Request,
  context: RouteContext<"/api/conversations/[id]/takeover">,
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
      select: { id: true },
    });

    if (!conversation) {
      return notFound();
    }

    const pausedUntil = new Date(Date.now() + TAKEOVER_MINUTES * 60_000);

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { pausedUntil, status: "HUMAN_TAKEOVER" },
    });

    return Response.json({ pausedUntil });
  } catch (error) {
    console.error("[POST /api/conversations/[id]/takeover]", error);
    return Response.json(
      {
        error: "Failed to pause the conversation",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// DELETE /api/conversations/[id]/takeover
// Hands the conversation back to the AI.
export async function DELETE(
  request: Request,
  context: RouteContext<"/api/conversations/[id]/takeover">,
) {
  try {
    const businessId = await getCurrentBusinessId();

    if (!businessId) {
      return unauthorized();
    }

    const { id } = await context.params;

    const conversation = await prisma.conversation.findFirst({
      where: { id, businessId },
      select: { id: true },
    });

    if (!conversation) {
      return notFound();
    }

    // Optional per-chat context captured when the owner resumes the AI.
    const body = (await request.json().catch(() => null)) as {
      aiContext?: unknown;
    } | null;
    const aiContext =
      typeof body?.aiContext === "string" ? body.aiContext.trim() : undefined;

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        pausedUntil: null,
        status: "AI_HANDLING",
        ...(aiContext !== undefined ? { aiContext: aiContext || null } : {}),
      },
    });

    return Response.json({ pausedUntil: null });
  } catch (error) {
    console.error("[DELETE /api/conversations/[id]/takeover]", error);
    return Response.json(
      {
        error: "Failed to resume the conversation",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
