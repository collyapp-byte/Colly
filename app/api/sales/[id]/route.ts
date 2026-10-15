import { prisma } from "@/lib/prisma";
import { getCurrentBusinessId } from "@/lib/auth";

const SALE_STATUSES = ["paid", "pending", "cancelled"] as const;

type SaleStatus = (typeof SALE_STATUSES)[number];

function isSaleStatus(value: unknown): value is SaleStatus {
  return (
    typeof value === "string" &&
    (SALE_STATUSES as readonly string[]).includes(value)
  );
}

type SaleRequestBody = {
  status?: unknown;
};

// Relation shape shared by every sale response.
const SALE_INCLUDE = {
  customer: { select: { id: true, name: true } },
  product: { select: { id: true, name: true, images: true } },
} as const;

function badRequest(error: string) {
  return Response.json({ error }, { status: 400 });
}

function notFound() {
  return Response.json({ error: "Sale not found" }, { status: 404 });
}

function unauthorized() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}

function serializeSale(sale: {
  totalAmount: unknown;
  [key: string]: unknown;
}) {
  return { ...sale, totalAmount: Number(sale.totalAmount) };
}

// GET /api/sales/[id]
export async function GET(
  _request: Request,
  context: RouteContext<"/api/sales/[id]">,
) {
  try {
    const businessId = await getCurrentBusinessId();

    if (!businessId) {
      return unauthorized();
    }

    const { id } = await context.params;

    const sale = await prisma.sale.findFirst({
      where: { id, businessId },
      include: SALE_INCLUDE,
    });

    if (!sale) {
      return notFound();
    }

    return Response.json({ sale: serializeSale(sale) });
  } catch (error) {
    console.error("[GET /api/sales/[id]]", error);
    return Response.json(
      {
        error: "Failed to load sale",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// PATCH /api/sales/[id]
// Body: { status: "paid" | "pending" | "cancelled" }
export async function PATCH(
  request: Request,
  context: RouteContext<"/api/sales/[id]">,
) {
  try {
    const businessId = await getCurrentBusinessId();

    if (!businessId) {
      return unauthorized();
    }

    const { id } = await context.params;
    const body = (await request.json()) as SaleRequestBody;

    if (!isSaleStatus(body.status)) {
      return badRequest('Status must be one of "paid", "pending" or "cancelled"');
    }
    const nextStatus = body.status;

    // Scoped by businessId: a sale belonging to another tenant reads as
    // "not found" rather than being editable.
    const existing = await prisma.sale.findFirst({ where: { id, businessId } });
    if (!existing) {
      return notFound();
    }

    const sale = await prisma.$transaction(async (tx) => {
      // Custom amount lines have no product, so there is no stock to move.
      const product = existing.productId
        ? await tx.product.findUnique({
            where: { id: existing.productId },
            select: { stock: true },
          })
        : null;
      const tracksStock = product !== null && product.stock !== null;

      const updated = await tx.sale.update({
        where: { id },
        data: { status: nextStatus },
        include: SALE_INCLUDE,
      });

      // Moving into "paid" takes the units off the shelf (tracked stock only).
      if (
        nextStatus === "paid" &&
        existing.status !== "paid" &&
        tracksStock &&
        existing.productId
      ) {
        await tx.product.update({
          where: { id: existing.productId },
          data: { stock: { decrement: existing.quantity } },
        });
      }

      // Cancelling a paid sale puts them back.
      if (
        existing.status === "paid" &&
        nextStatus === "cancelled" &&
        tracksStock &&
        existing.productId
      ) {
        await tx.product.update({
          where: { id: existing.productId },
          data: { stock: { increment: existing.quantity } },
        });
      }

      return updated;
    });

    return Response.json({ sale: serializeSale(sale) });
  } catch (error) {
    console.error("[PATCH /api/sales/[id]]", error);
    return Response.json(
      {
        error: "Failed to update sale",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// DELETE /api/sales/[id]
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const businessId = await getCurrentBusinessId();

    if (!businessId) {
      return unauthorized();
    }

    const params = await context.params;
    const { id } = params as { id: string };

    const existing = await prisma.sale.findFirst({ where: { id, businessId } });
    if (!existing) {
      return notFound();
    }

    await prisma.$transaction(async (tx) => {
      // Deleting a paid sale returns its units to the shelf (tracked stock
      // only; productless custom amount lines have no stock to restore).
      if (existing.status === "paid" && existing.productId) {
        const product = await tx.product.findUnique({
          where: { id: existing.productId },
          select: { stock: true },
        });

        if (product !== null && product.stock !== null) {
          await tx.product.update({
            where: { id: existing.productId },
            data: { stock: { increment: existing.quantity } },
          });
        }
      }

      await tx.sale.delete({ where: { id } });
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/sales/[id]]", error);
    return Response.json(
      {
        error: "Failed to delete sale",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}