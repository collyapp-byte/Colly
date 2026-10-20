import { prisma } from "@/lib/prisma";
import { getCurrentAgent } from "@/lib/agent-auth";
import { createTransferRecipient, listBanks } from "@/lib/paystack";

function unauthorized() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}

function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

// GET /api/agents/bank-details
// Return the list of Nigerian banks from Paystack.
export async function GET() {
  try {
    const agent = await getCurrentAgent();
    if (!agent) return unauthorized();

    const [banks, payouts] = await Promise.all([
      listBanks(),
      prisma.agentPayout.findMany({
        where: { agentId: agent.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    return Response.json({
      banks,
      bankDetails: {
        bankAccountName: agent.bankAccountName,
        bankAccountNumber: agent.bankAccountNumber,
        bankCode: agent.bankCode,
        paystackRecipientCode: agent.paystackRecipientCode,
      },
      commissionBalanceNaira: agent.commissionBalanceNaira,
      payouts: payouts.map((p) => ({
        id: p.id,
        amountNaira: p.amountNaira,
        status: p.status,
        reference: p.reference,
        createdAt: p.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[GET /api/agents/bank-details]", error);
    return Response.json(
      {
        error: "Failed to load banks",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// POST /api/agents/bank-details
// Save bank details and create a Paystack transfer recipient.
export async function POST(request: Request) {
  try {
    const agent = await getCurrentAgent();
    if (!agent) return unauthorized();

    const body = (await request.json()) as {
      bankAccountName?: string;
      bankAccountNumber?: string;
      bankCode?: string;
    };

    const bankAccountName = body.bankAccountName?.trim();
    const bankAccountNumber = body.bankAccountNumber?.trim();
    const bankCode = body.bankCode?.trim();

    if (!bankAccountName || !bankAccountNumber || !bankCode) {
      return badRequest("All bank details are required");
    }

    const recipient = await createTransferRecipient({
      name: bankAccountName,
      accountNumber: bankAccountNumber,
      bankCode,
    });

    await prisma.agent.update({
      where: { id: agent.id },
      data: {
        bankAccountName,
        bankAccountNumber,
        bankCode,
        paystackRecipientCode: recipient.recipient_code,
      },
    });

    return Response.json({
      success: true,
      recipientCode: recipient.recipient_code,
    });
  } catch (error) {
    console.error("[POST /api/agents/bank-details]", error);
    return Response.json(
      {
        error: "Failed to save bank details",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
