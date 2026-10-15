import { prisma } from "@/lib/prisma";
import { getCurrentBusinessId } from "@/lib/auth";
import {
  INVOICE_INCLUDE,
  isInvoiceStatus,
  serializeInvoice,
  type InvoiceStatus,
} from "@/lib/invoices";

/** Statuses an invoice may move to, keyed by its current status. */
const ALLOWED_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ["sent", "cancelled"],
  sent: ["cancelled"],
  failed: ["draft", "cancelled"],
  cancelled: [],
};

type InvoiceRequestBody = {
  status?: unknown;
};

function badRequest(error: string) {
  return Response.json({ error }, { status: 400 });
}

function notFound() {
  return Response.json({ error: "Invoice not found" }, { status: 404 });
}

function unauthorized() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}

// GET /api/invoices/[id]
export async function GET(
  _request: Request,
  context: RouteContext<"/api/invoices/[id]">,
) {
  try {
    const businessId = await getCurrentBusinessId();

    if (!businessId) {
      return unauthorized();
    }

    const { id } = await context.params;

    const invoice = await prisma.invoice.findFirst({
      where: { id, businessId },
      include: INVOICE_INCLUDE,
    });

    if (!invoice) {
      return notFound();
    }

    return Response.json({ invoice: serializeInvoice(invoice) });
  } catch (error) {
    console.error("[GET /api/invoices/[id]]", error);
    return Response.json(
      {
        error: "Failed to load invoice",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// PATCH /api/invoices/[id]
// Body: { status }. Only valid transitions are accepted (e.g. draft -> sent,
// sent -> cancelled, failed -> draft for a retry).
export async function PATCH(
  request: Request,
  context: RouteContext<"/api/invoices/[id]">,
) {
  try {
    const businessId = await getCurrentBusinessId();

    if (!businessId) {
      return unauthorized();
    }

    const { id } = await context.params;
    const body = (await request.json()) as InvoiceRequestBody;

    if (!isInvoiceStatus(body.status)) {
      return badRequest(
        'Status must be one of "draft", "sent", "failed" or "cancelled"',
      );
    }
    const nextStatus = body.status;

    const existing = await prisma.invoice.findFirst({
      where: { id, businessId },
    });
    if (!existing) {
      return notFound();
    }

    const current = existing.status as InvoiceStatus;
    if (current === nextStatus) {
      return Response.json({ invoice: serializeInvoice(existing) });
    }

    const allowed = ALLOWED_TRANSITIONS[current] ?? [];
    if (!allowed.includes(nextStatus)) {
      return badRequest(
        `Cannot change invoice status from "${current}" to "${nextStatus}"`,
      );
    }

    const invoice = await prisma.invoice.update({
      where: { id },
      data: { status: nextStatus },
      include: INVOICE_INCLUDE,
    });

    return Response.json({ invoice: serializeInvoice(invoice) });
  } catch (error) {
    console.error("[PATCH /api/invoices/[id]]", error);
    return Response.json(
      {
        error: "Failed to update invoice",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// DELETE /api/invoices/[id]
// Only draft or cancelled invoices can be deleted; anything already sent to the
// NRS must be kept for the audit trail.
export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/invoices/[id]">,
) {
  try {
    const businessId = await getCurrentBusinessId();

    if (!businessId) {
      return unauthorized();
    }

    const { id } = await context.params;

    const existing = await prisma.invoice.findFirst({ where: { id, businessId } });
    if (!existing) {
      return notFound();
    }

    if (existing.status !== "draft" && existing.status !== "cancelled") {
      return badRequest("Only draft or cancelled invoices can be deleted");
    }

    await prisma.invoice.delete({ where: { id } });

    return Response.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/invoices/[id]]", error);
    return Response.json(
      {
        error: "Failed to delete invoice",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
