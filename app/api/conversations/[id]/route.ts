import { prisma } from "@/lib/prisma";
import { getCurrentBusinessId } from "@/lib/auth";
import { getPlanLimits } from "@/lib/plans";

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

    // Plan state for the page banner: on the free plan the AI is off and the
    // owner gets `includedManualMessages` free manual replies each billing
    // month. The page shows how many are left and keeps the composer enabled
    // until they run out.
    const business = await prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      select: {
        plan: true,
        planInterval: true,
        channel: true,
        planStatus: true,
        manualMessagesUsedThisMonth: true,
      },
    });
    const limits = getPlanLimits(
      business.plan,
      business.planInterval,
      business.channel,
    );
    const includedManualMessages = limits.includedManualMessages;
    const manualMessagesRemaining = Math.max(
      includedManualMessages - business.manualMessagesUsedThisMonth,
      0,
    );
    const aiPaused = business.plan === "free" || business.planStatus !== "active";

    return Response.json({
      conversation: meta,
      messages: messages.map((message) => ({
        id: message.id,
        sender: message.sender,
        content: message.content,
        createdAt: message.createdAt,
      })),
      plan: {
        plan: business.plan,
        aiPaused,
        includedManualMessages,
        manualMessagesRemaining,
      },
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
