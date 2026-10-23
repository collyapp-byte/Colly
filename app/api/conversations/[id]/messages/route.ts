import { prisma } from "@/lib/prisma";
import { getCurrentBusinessId } from "@/lib/auth";
import { getCreditPrice, getPlanLimits } from "@/lib/plans";

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
//
// Manual replies are metered like AI replies: the first `includedManualMessages`
// per billing month are free, after that each reply costs the channel's
// `manualCredit` Naira out of the wallet (Telegram's rate is 0, so those replies
// stay free). When the wallet cannot cover the reply it is blocked.
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
      return Response.json({ error: "Message content is required" }, { status: 400 });
    }

    const conversation = await prisma.conversation.findFirst({
      where: { id, businessId },
      include: { customer: true, business: true },
    });

    if (!conversation) {
      return notFound();
    }

    const business = await prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      select: {
        plan: true,
        planInterval: true,
        channel: true,
        creditWalletBalanceNaira: true,
        manualMessagesUsedThisMonth: true,
      },
    });

    const limits = getPlanLimits(business.plan, business.planInterval);
    const includedManualMessages = limits.includedManualMessages;
    const manualCreditPrice = getCreditPrice(business, "manual");

    // Under the monthly allowance the reply is free; otherwise the wallet pays
    // the channel's per-reply rate.
    const withinAllowance =
      business.manualMessagesUsedThisMonth < includedManualMessages;

    if (!withinAllowance && business.creditWalletBalanceNaira < manualCreditPrice) {
      return Response.json(
        { error: "Insufficient wallet balance. Top up to reply manually." },
        { status: 402 },
      );
    }

    const businessUpdate = withinAllowance
      ? {
          manualMessagesUsedThisMonth: { increment: 1 },
          // Trial counter: how many manual replies the 7-day trial has spent.
          manualMessagesUsed: { increment: 1 },
        }
      : {
          creditWalletBalanceNaira: { decrement: manualCreditPrice },
          manualMessagesUsedThisMonth: { increment: 1 },
          manualMessagesUsed: { increment: 1 },
        };

    // Charge the business and store the reply atomically, so a failed write
    // never leaves the wallet debited without a message.
    const [, message] = await prisma.$transaction([
      prisma.business.update({ where: { id: businessId }, data: businessUpdate }),
      prisma.message.create({
        data: {
          businessId,
          conversationId: conversation.id,
          sender: "agent",
          content,
        },
      }),
    ]);

    // Relay the saved reply to the customer's Telegram chat. Telegram customers
    // store their chat id in `Customer.phone` (see the Telegram webhook). A
    // failed send must not fail the request: the dashboard message is saved.
    try {
      const chatId = conversation.customer.phone?.trim();
      const botToken = conversation.business.telegramBotToken;

      if (
        conversation.business.channel === "TELEGRAM" &&
        chatId &&
        botToken
      ) {
        const telegramResponse = await fetch(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: content }),
            signal: AbortSignal.timeout(10_000),
          },
        );

        if (!telegramResponse.ok) {
          const detail = await telegramResponse.text().catch(() => "");
          console.error(
            `[POST /api/conversations/[id]/messages] Telegram send failed (${telegramResponse.status}): ${detail}`,
          );
        }
      }
    } catch (error) {
      console.error(
        "[POST /api/conversations/[id]/messages] Telegram relay failed:",
        error,
      );
    }

    return Response.json(
      {
        message: {
          id: message.id,
          sender: message.sender,
          content: message.content,
          createdAt: message.createdAt,
        },
      },
      { status: 200 },
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
