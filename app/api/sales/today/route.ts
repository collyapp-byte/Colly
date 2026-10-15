import { prisma } from "@/lib/prisma";
import { getCurrentBusinessId } from "@/lib/auth";

function unauthorized() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}

// GET /api/sales/today
// Sum and count of the business's paid sales created since the start of today
// (local time). Feeds the "Today's Sales" card on the overview page.
export async function GET() {
  try {
    const businessId = await getCurrentBusinessId();

    if (!businessId) {
      return unauthorized();
    }

    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    const aggregate = await prisma.sale.aggregate({
      where: { businessId, status: "paid", createdAt: { gte: startOfToday } },
      _sum: { totalAmount: true },
      _count: true,
    });

    return Response.json({
      total: Number(aggregate._sum.totalAmount ?? 0),
      count: aggregate._count,
    });
  } catch (error) {
    console.error("[GET /api/sales/today]", error);
    return Response.json(
      {
        error: "Failed to load today's sales",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}