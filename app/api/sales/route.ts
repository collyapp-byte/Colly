import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentBusinessId } from "@/lib/auth";
import { createInvoiceFromSale } from "@/lib/invoices";

const SALE_STATUSES = ["paid", "pending", "cancelled"] as const;

type SaleStatus = (typeof SALE_STATUSES)[number];

function isSaleStatus(value: unknown): value is SaleStatus {
  return (
    typeof value === "string" &&
    (SALE_STATUSES as readonly string[]).includes(value)
  );
}

type SaleRequestBody = {
  customerId?: unknown;
  productId?: unknown;
  quantity?: unknown;
  status?: unknown;
  /** How it was paid: "cash" | "transfer" | "pos" | "credit". */
  paymentMethod?: unknown;
  /** Productless "custom amount" lines (Quick Sale), shown as the sale's name. */
  customLabel?: unknown;
  /** Per-unit price of a custom amount line. */
  unitAmount?: unknown;
};

const PAYMENT_METHODS = ["cash", "transfer", "pos", "credit"] as const;

// Relation shape shared by every sale response.
const SALE_INCLUDE = {
  customer: { select: { id: true, name: true } },
  product: { select: { id: true, name: true, images: true } },
} as const;

function badRequest(error: string) {
  return Response.json({ error }, { status: 400 });
}

function notFound(error: string) {
  return Response.json({ error }, { status: 404 });
}

function unauthorized() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}

function serializeSale(sale: {
  totalAmount: unknown;
  paymentMethod?: string | null;
  [key: string]: unknown;
}) {
  return {
    ...sale,
    totalAmount: Number(sale.totalAmount),
    paymentMethod: sale.paymentMethod ?? null,
  };
}

// GET /api/sales?status=paid&from=2026-01-01&to=2026-12-31
// Every sale for the signed-in business, newest first, with the customer and
// product each sale refers to. `status` filters by state; `from` and `to`
// filter by the sale's createdAt date (YYYY-MM-DD, inclusive).
export async function GET(request: Request) {
  try {
    const businessId = await getCurrentBusinessId();

    if (!businessId) {
      return unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const rawStatus = searchParams.get("status");
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    const where: Prisma.SaleWhereInput = { businessId };
    if (isSaleStatus(rawStatus)) {
      where.status = rawStatus;
    }

    const fromDate = fromParam ? new Date(`${fromParam}T00:00:00`) : null;
    const toDate = toParam ? new Date(`${toParam}T23:59:59.999`) : null;

    const createdAt: Prisma.DateTimeFilter = {};
    if (fromDate && !Number.isNaN(fromDate.getTime())) {
      createdAt.gte = fromDate;
    }
    if (toDate && !Number.isNaN(toDate.getTime())) {
      createdAt.lte = toDate;
    }
    if (createdAt.gte !== undefined || createdAt.lte !== undefined) {
      where.createdAt = createdAt;
    }

    const sales = await prisma.sale.findMany({
      where,
      include: SALE_INCLUDE,
      orderBy: { createdAt: "desc" },
    });

    return Response.json({ sales: sales.map(serializeSale) });
  } catch (error) {
    console.error("[GET /api/sales]", error);
    return Response.json(
      {
        error: "Failed to load sales",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// POST /api/sales
// Body: { customerId?, productId?, quantity, status?, customLabel?, unitAmount? }
//
// A catalogue sale uses `productId` and prices itself from the product. A
// productless "custom amount" line (Quick Sale for items not in the catalogue)
// omits `productId` and sends `customLabel` + `unitAmount` instead.
//
// `customerId` is required for credit sales but optional otherwise: when it is
// omitted the sale is attached to the business's shared "Walk-in Customer".
export async function POST(request: Request) {
  try {
    const businessId = await getCurrentBusinessId();

    if (!businessId) {
      return unauthorized();
    }

    const body = (await request.json()) as SaleRequestBody;
    const customerId =
      typeof body.customerId === "string" ? body.customerId.trim() : "";
    const productId =
      typeof body.productId === "string" ? body.productId.trim() : "";
    const status = body.status === undefined ? "paid" : body.status;

    if (
      typeof body.quantity !== "number" ||
      !Number.isInteger(body.quantity) ||
      body.quantity <= 0
    ) {
      return badRequest("Quantity must be a positive whole number");
    }
    if (!isSaleStatus(status)) {
      return badRequest('Status must be one of "paid", "pending" or "cancelled"');
    }

    // Payment method: optional; normalised to lowercase ("Cash" → "cash").
    let paymentMethod: string | null = null;
    if (body.paymentMethod !== undefined && body.paymentMethod !== null) {
      if (typeof body.paymentMethod !== "string") {
        return badRequest("paymentMethod must be a string");
      }
      const normalized = body.paymentMethod.trim().toLowerCase();
      if (normalized && !(PAYMENT_METHODS as readonly string[]).includes(normalized)) {
        return badRequest(
          'paymentMethod must be one of "cash", "transfer", "pos" or "credit"',
        );
      }
      paymentMethod = normalized || null;
    }

    // The caller may target their own customer, or omit the id to fall back on
    // the business-wide "Walk-in Customer" (how over-the-counter sales work).
    let resolvedCustomerId = customerId;
    if (resolvedCustomerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: resolvedCustomerId, businessId },
        select: { id: true },
      });
      if (!customer) {
        return notFound("Customer not found");
      }
    } else {
      const existing = await prisma.customer.findFirst({
        where: { businessId, name: "Walk-in Customer", phone: "" },
        select: { id: true },
      });
      resolvedCustomerId =
        existing?.id ??
        (
          await prisma.customer.create({
            data: { businessId, name: "Walk-in Customer", phone: "" },
            select: { id: true },
          })
        ).id;
    }

    let totalAmount: number;

    // Catalogue line: price comes from the stored product, and a paid sale
    // takes the units off the shelf (when stock is tracked).
    if (productId) {
      const product = await prisma.product.findFirst({
        where: { id: productId, businessId },
        select: { id: true, price: true, stock: true },
      });
      if (!product) {
        return notFound("Product not found");
      }

      totalAmount = Number(product.price) * body.quantity;
    } else {
      const customLabel =
        typeof body.customLabel === "string" ? body.customLabel.trim() : "";
      const unitAmount = body.unitAmount;

      if (!customLabel) {
        return badRequest("customLabel is required for custom amount lines");
      }
      if (
        typeof unitAmount !== "number" ||
        !Number.isFinite(unitAmount) ||
        unitAmount < 0
      ) {
        return badRequest(
          "unitAmount must be a number greater than or equal to 0",
        );
      }

      totalAmount = unitAmount * body.quantity;
    }
    const isCustomLine = !productId;

    const sale = await prisma.$transaction(async (tx) => {
      const created = await tx.sale.create({
        data: {
          businessId,
          customerId: resolvedCustomerId,
          productId: isCustomLine ? null : productId,
          customLabel: isCustomLine ? body.customLabel as string : null,
          quantity: body.quantity as number,
          totalAmount,
          status,
          paymentMethod,
        },
        include: SALE_INCLUDE,
      });

      // A paid catalogue sale immediately leaves the shelf — unless the owner
      // does not track stock, in which case there is nothing to decrement.
      if (!isCustomLine && status === "paid") {
        const product = await tx.product.findUnique({
          where: { id: productId },
          select: { stock: true },
        });
        if (product !== null && product.stock !== null) {
          await tx.product.update({
            where: { id: productId },
            data: { stock: { decrement: body.quantity as number } },
          });
        }
      }

      return created;
    });

    // Every paid sale gets a draft invoice. The sale is already committed, so an
    // invoice failure is logged but never fails the request.
    if (status === "paid") {
      try {
        await createInvoiceFromSale(sale.id);
      } catch (invoiceError) {
        console.error("[POST /api/sales] invoice creation failed", invoiceError);
      }
    }

    return Response.json({ sale: serializeSale(sale) }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/sales]", error);
    return Response.json(
      {
        error: "Failed to create sale",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}