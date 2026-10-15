import { prisma } from "@/lib/prisma";
import { getCurrentBusinessId } from "@/lib/auth";

function unauthorized() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}

// GET /api/billing/transactions
// Lists the signed-in business's payment history, newest first.
export async function GET() {
  try {
    const businessId = await getCurrentBusinessId();

    if (!businessId) {
      return unauthorized();
    }

    const transactions = await prisma.transaction.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({ transactions });
  } catch (error) {
    console.error("[GET /api/billing/transactions]", error);
    return Response.json(
      {
        error: "Failed to load transactions",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}