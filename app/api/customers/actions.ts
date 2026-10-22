"use server";

import { prisma } from "@/lib/prisma";

const CUSTOMER_DETAILS_SELECT = {
  id: true,
  tags: true,
  notes: true,
  totalSpent: true,
  lastContactedAt: true,
} as const;

type CustomerDetails = {
  id: string;
  tags: string[];
  notes: string | null;
  totalSpent: number;
  lastContactedAt: Date | null;
};

type UpdateCustomerDetailsResult =
  | { ok: true; customer: CustomerDetails }
  | { ok: false; error: string };

type DeleteCustomerResult = { ok: true } | { ok: false; error: string };

export async function updateCustomerDetails(
  customerId: string,
  businessId: string,
  data: { tags?: string[]; notes?: string },
): Promise<UpdateCustomerDetailsResult> {
  if (!customerId || !businessId) {
    return { ok: false, error: "Missing customer or business." };
  }

  try {
    const existing = await prisma.customer.findFirst({
      where: { id: customerId, businessId },
      select: { id: true },
    });

    if (!existing) {
      return { ok: false, error: "Customer not found." };
    }

    const update: { tags?: string[]; notes?: string | null } = {};

    if (data.tags !== undefined) {
      if (!Array.isArray(data.tags)) {
        return { ok: false, error: "Tags must be a list of names." };
      }

      const tags = data.tags
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.trim())
        .filter(Boolean);
      update.tags = Array.from(new Set(tags));
    }

    if (data.notes !== undefined) {
      if (typeof data.notes !== "string") {
        return { ok: false, error: "Notes must be text." };
      }
      const notes = data.notes.trim();
      update.notes = notes.length > 0 ? notes : null;
    }

    const customer =
      Object.keys(update).length > 0
        ? await prisma.customer.update({
            where: { id: existing.id },
            data: update,
            select: CUSTOMER_DETAILS_SELECT,
          })
        : await prisma.customer.findUniqueOrThrow({
            where: { id: existing.id },
            select: CUSTOMER_DETAILS_SELECT,
          });

    return { ok: true, customer };
  } catch (error) {
    console.error("[updateCustomerDetails]", error);
    return { ok: false, error: "Could not update the customer. Please try again." };
  }
}

export async function deleteCustomer(
  customerId: string,
  businessId: string,
): Promise<DeleteCustomerResult> {
  if (!customerId || !businessId) {
    return { ok: false, error: "Missing customer or business." };
  }

  try {
    const existing = await prisma.customer.findFirst({
      where: { id: customerId, businessId },
      select: { id: true, _count: { select: { sales: true } } },
    });

    if (!existing) {
      return { ok: false, error: "Customer not found." };
    }

    if (existing._count.sales > 0) {
      return {
        ok: false,
        error:
          "This customer has sales and cannot be deleted. Keep the record for your sales history.",
      };
    }

    await prisma.$transaction([
      prisma.conversation.deleteMany({
        where: { businessId, customerId: existing.id },
      }),
      prisma.customer.delete({ where: { id: existing.id } }),
    ]);

    return { ok: true };
  } catch (error) {
    console.error("[deleteCustomer]", error);
    return { ok: false, error: "Could not delete the customer. Please try again." };
  }
}
