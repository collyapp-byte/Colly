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
    const reference = `AP-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;

    // Paystack is the point of failure: network errors throw, and a 200 with
    // `status: false` means the transfer was rejected. In both cases no money
    // moved, so we must not deduct the agent's balance or record a payout —
    // and we restore the balance to be safe (idempotent if it never changed).
    let transfer: { status?: string } | null = null;
    try {
      transfer = await initiateTransfer({
        amountKobo: amountNaira * 100,
        recipient: agent.paystackRecipientCode,
        reason: "Colly Agent Commission",
        reference,
      });
    } catch (error) {
      console.error("[POST /api/agents/payouts/request] transfer failed:", error);
      await prisma.agent.update({
        where: { id: agent.id },
        data: { commissionBalanceNaira: { increment: amountNaira } },
      });
      return Response.json(
        { error: "Payout failed. Your balance has been restored." },
        { status: 502 },
      );
    }

    if (!transfer || (transfer.status && transfer.status !== "success")) {
      await prisma.agent.update({
        where: { id: agent.id },
        data: { commissionBalanceNaira: { increment: amountNaira } },
      });
      return Response.json(
        { error: "Payout failed. Your balance has been restored." },
        { status: 502 },
      );
    }

    // Deduct the amount and record the payout.
    await prisma.$transaction(async (tx) => {
      await tx.agent.update({
        where: { id: agent.id },
        data: {
          commissionBalanceNaira: { decrement: amountNaira },
        },
      });

      await tx.agentPayout.create({
        data: {
          agentId: agent.id,
          amountNaira,
          status: "success",
          reference,
        },
      });
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
