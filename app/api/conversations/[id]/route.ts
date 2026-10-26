import { prisma } from "@/lib/prisma";
import { getCurrentBusinessId } from "@/lib/auth";
import { getAiReplyCreditCost, getPlanLimits, totalAvailableCredits } from "@/lib/plans";

function unauthorized() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}

// DELETE /api/conversations/[id]
// Deletes a conversation (and its messages via cascade) for the signed-in
// business. Used by the swipe-to-delete action on the conversations list.
export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/conversations/[id]">,
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
      return Response.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
    }

    await prisma.conversation.delete({ where: { id: conversation.id } });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/conversations/[id]]", error);
    return Response.json(
      {
        error: "Failed to delete conversation",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
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

    // Billing state for the page banner. Credit Economy: AI replies spend
    // credits (5 on Telegram/Discord/Web Chat, 80 on WhatsApp) while manual
    // replies are always free, so only the AI can be paused by billing.
    const business = await prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      select: {
        plan: true,
        planInterval: true,
        channel: true,
        planStatus: true,
        planCredits: true,
        topUpCredits: true,
      },
    });
    const limits = getPlanLimits(business.plan, business.planInterval);
    const aiCreditCost = getAiReplyCreditCost(business.channel);
    // Split wallet: the AI can reply while the allowance plus top-ups cover it.
    const aiPaused = totalAvailableCredits(business) < aiCreditCost;

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
        planCredits: business.planCredits,
        topUpCredits: business.topUpCredits,
        creditBalance: totalAvailableCredits(business),
        planMonthlyCredits: limits.credits,
        aiCreditCost,
        manualCreditCost: 0,
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
