import { prisma } from "@/lib/prisma";
import { getCurrentAgent } from "@/lib/agent-auth";
import { initiateTransfer } from "@/lib/paystack";
import { randomUUID } from "node:crypto";

function unauthorized() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}

function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

const PAYOUT_MIN_NAIRA = 5000;

// POST /api/agents/payouts/request
// Request a payout of the available commission balance (min ₦5000).
export async function POST() {
  try {
    const agent = await getCurrentAgent();
    if (!agent) return unauthorized();

    if (agent.commissionBalanceNaira < PAYOUT_MIN_NAIRA) {
      return badRequest(
        `Minimum payout is ₦${PAYOUT_MIN_NAIRA.toLocaleString()}.`,
      );
    }

    if (!agent.paystackRecipientCode) {
      return badRequest("Please add your bank details before requesting a payout.");
    }

    const amountNaira = agent.commissionBalanceNaira;
    const agentId = agent.id;
    const recipientCode = agent.paystackRecipientCode;
    const reference = `AP-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;

    // Atomically claim the balance before touching Paystack. This prevents two
    // concurrent requests from both reading the same balance and paying twice.
    const claimed = await prisma.agent.updateMany({
      where: {
        id: agentId,
        commissionBalanceNaira: { gte: amountNaira },
      },
      data: { commissionBalanceNaira: { decrement: amountNaira } },
    });

    if (claimed.count === 0) {
      return badRequest("Insufficient balance");
    }

    async function restoreBalance() {
      await prisma.agent.update({
        where: { id: agentId },
        data: { commissionBalanceNaira: { increment: amountNaira } },
      });
    }

    // Paystack is the point of failure: network errors throw, and a 200 with
    // `status: false` means the transfer was rejected. The balance was already
    // claimed above, so every failure path restores it exactly once.
    let transfer: { status?: string } | null = null;
    try {
      transfer = await initiateTransfer({
        amountKobo: amountNaira * 100,
        recipient: recipientCode,
        reason: "Colly Agent Commission",
        reference,
      });
    } catch (error) {
      console.error("[POST /api/agents/payouts/request] transfer failed:", error);
      await restoreBalance();
      return Response.json(
        { error: "Payout failed. Your balance has been restored." },
        { status: 502 },
      );
    }

    if (!transfer || (transfer.status && transfer.status !== "success")) {
      await restoreBalance();
      return Response.json(
        { error: "Payout failed. Your balance has been restored." },
        { status: 502 },
      );
    }

    // The balance was already deducted by the atomic claim; record the payout.
    await prisma.agentPayout.create({
      data: {
        agentId: agentId,
        amountNaira,
        status: "success",
        reference,
      },
    });

    console.log("[payout] completed", {
      agentId: agentId,
      amountNaira,
      reference,
    });

    return Response.json({
      success: true,
      amountNaira,
      reference,
    });
  } catch (error) {
    console.error("[POST /api/agents/payouts/request]", error);
    return Response.json(
      {
        error: "Failed to request payout",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
