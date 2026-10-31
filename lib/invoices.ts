import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Standard VAT rate applied to new invoices, as a percentage. */
export const VAT_RATE = 7.5;

export const INVOICE_STATUSES = [
  "draft",
  "sent",
  "paid",
  "failed",
  "cancelled",
] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export function isInvoiceStatus(value: unknown): value is InvoiceStatus {
  return (
    typeof value === "string" &&
    (INVOICE_STATUSES as readonly string[]).includes(value)
  );
}

/** A single line on an invoice. Stored as JSON in `Invoice.items`. */
export type InvoiceItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

/** Relation shape shared by every invoice response. */
export const INVOICE_INCLUDE = {
  customer: { select: { id: true, name: true, phone: true } },
  sale: { select: { id: true, createdAt: true } },
} as const;

/** Rounds to two decimal places (money), avoiding float drift. */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Converts Naira to integer kobo.
 *
 * Invoices store money as `Decimal(10, 2)` Naira, but every calculation that
 * touches customer-supplied amounts (an AI reading a receipt, a Paystack
 * charge) runs on integer kobo: `0.1 + 0.2` is not `0.3` in binary floating
 * point, so a receipt for ₦25,000.10 must not drift by a kobo on the way to the
 * database or into the owner's alert.
 */
export function nairaToKobo(amountNaira: number): number {
  return Math.round(amountNaira * 100);
}

/** Converts integer kobo back to Naira for a `Decimal(10, 2)` column. */
export function koboToNaira(amountKobo: number): number {
  return Math.round(amountKobo) / 100;
}

/**
 * Note stamped on a draft invoice the AI creates from a customer's payment
 * receipt. The AI can never mark an invoice as paid: the owner verifies the
 * receipt and approves it in the dashboard.
 */
export const RECEIPT_INVOICE_NOTE =
  "Auto-generated from customer receipt. Needs owner verification.";

/** Computes subtotal, VAT and total from line items. */
export function computeTotals(items: InvoiceItem[], vatRate = VAT_RATE) {
  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.total, 0));
  const vat = roundMoney(subtotal * (vatRate / 100));
  const total = roundMoney(subtotal + vat);
  return { subtotal, vat, total };
}

/** Converts Prisma Decimal columns to numbers for JSON responses. */
export function serializeInvoice<
  T extends { subtotal: unknown; vat: unknown; total: unknown },
>(invoice: T) {
  return {
    ...invoice,
    subtotal: Number(invoice.subtotal),
    vat: Number(invoice.vat),
    total: Number(invoice.total),
  };
}

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Next invoice number for a business, formatted "INV-YYYY-NNNN" and sequenced
 * per business per calendar year. Falls back to 0001 when none exist yet.
 */
export async function generateInvoiceNumber(
  businessId: string,
  db: Db = prisma,
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;

  const last = await db.invoice.findFirst({
    where: { businessId, invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });

  let next = 1;
  if (last) {
    const parsed = Number.parseInt(last.invoiceNumber.slice(prefix.length), 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      next = parsed + 1;
    }
  }

  return `${prefix}${String(next).padStart(4, "0")}`;
}

/**
 * Creates the draft invoice that backs a paid sale, copying the sale into a
 * single line item and applying VAT. Every paid sale should generate one.
 */
export async function createInvoiceFromSale(saleId: string) {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: { product: { select: { name: true } } },
  });

  if (!sale) {
    throw new Error("Sale not found");
  }

  const item: InvoiceItem = {
    name: sale.product?.name ?? sale.customLabel ?? "Custom amount",
    quantity: sale.quantity,
    unitPrice: roundMoney(Number(sale.totalAmount) / sale.quantity),
    total: Number(sale.totalAmount),
  };
  const { subtotal, vat, total } = computeTotals([item]);
  const invoiceNumber = await generateInvoiceNumber(sale.businessId);

  return prisma.invoice.create({
    data: {
      businessId: sale.businessId,
      saleId: sale.id,
      customerId: sale.customerId,
      invoiceNumber,
      status: "draft",
      subtotal,
      vat,
      total,
      items: [item],
    },
    include: INVOICE_INCLUDE,
  });
}
