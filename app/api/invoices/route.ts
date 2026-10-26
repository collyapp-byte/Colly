import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentBusinessId } from "@/lib/auth";
import {
  computeTotals,
  generateInvoiceNumber,
  INVOICE_INCLUDE,
  isInvoiceStatus,
  roundMoney,
  serializeInvoice,
  VAT_RATE,
  type InvoiceItem,
} from "@/lib/invoices";

function badRequest(error: string) {
  return Response.json({ error }, { status: 400 });
}

function notFound(error: string) {
  return Response.json({ error }, { status: 404 });
}

function unauthorized() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}

/** Rows per page for the list endpoints; see the note on pagination in GET. */
const LIST_PAGE_SIZE = 50;

type InvoiceRequestBody = {
  customerId?: unknown;
  items?: unknown;
  vatRate?: unknown;
};

/**
 * Validates the raw `items` payload into line items with a computed total.
 * Returns an error string when the shape is wrong.
 */
function parseItems(raw: unknown): InvoiceItem[] | string {
  if (!Array.isArray(raw) || raw.length === 0) {
    return "At least one line item is required";
  }

  const items: InvoiceItem[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) {
      return "Each line item must be an object";
    }
    const { name, quantity, unitPrice } = entry as Record<string, unknown>;

    if (typeof name !== "string" || name.trim() === "") {
      return "Each line item needs a name";
    }
    if (
      typeof quantity !== "number" ||
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      return "Each line item needs a positive whole-number quantity";
    }
    if (
      typeof unitPrice !== "number" ||
      !Number.isFinite(unitPrice) ||
      unitPrice < 0
    ) {
      return "Each line item needs a unit price of 0 or more";
    }

    items.push({
      name: name.trim(),
      quantity,
      unitPrice: roundMoney(unitPrice),
      total: roundMoney(unitPrice * quantity),
    });
  }

  return items;
}

// GET /api/invoices?status=draft&from=2026-01-01&to=2026-12-31
// Every invoice for the signed-in business, newest first, with the customer it
// was billed to. `status` filters by state; `from`/`to` filter by createdAt.
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

    const where: Prisma.InvoiceWhereInput = { businessId };
    if (isInvoiceStatus(rawStatus)) {
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

    // Newest first, one page: unbounded invoice history is the slowest list in
    // the app to render. Cursor pagination is the follow-up.
    const invoices = await prisma.invoice.findMany({
      where,
      include: INVOICE_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: LIST_PAGE_SIZE,
    });

    return Response.json({ invoices: invoices.map(serializeInvoice) });
  } catch (error) {
    console.error("[GET /api/invoices]", error);
    return Response.json(
      {
        error: "Failed to load invoices",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// POST /api/invoices
// Body: { customerId?, items: [{ name, quantity, unitPrice }], vatRate? }
// Creates a manual invoice (not tied to a sale). VAT defaults to 7.5%.
export async function POST(request: Request) {
  try {
    const businessId = await getCurrentBusinessId();

    if (!businessId) {
      return unauthorized();
    }

    const body = (await request.json()) as InvoiceRequestBody;

    const items = parseItems(body.items);
    if (typeof items === "string") {
      return badRequest(items);
    }

    const vatRate =
      body.vatRate === undefined ? VAT_RATE : Number(body.vatRate);
    if (!Number.isFinite(vatRate) || vatRate < 0) {
      return badRequest("vatRate must be a number greater than or equal to 0");
    }

    const customerId =
      typeof body.customerId === "string" ? body.customerId.trim() : "";
    if (customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, businessId },
        select: { id: true },
      });
      if (!customer) {
        return notFound("Customer not found");
      }
    }

    const { subtotal, vat, total } = computeTotals(items, vatRate);
    const invoiceNumber = await generateInvoiceNumber(businessId);

    const invoice = await prisma.invoice.create({
      data: {
        businessId,
        customerId: customerId || null,
        invoiceNumber,
        status: "draft",
        subtotal,
        vat,
        total,
        items,
      },
      include: INVOICE_INCLUDE,
    });

    return Response.json({ invoice: serializeInvoice(invoice) }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/invoices]", error);
    return Response.json(
      {
        error: "Failed to create invoice",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
