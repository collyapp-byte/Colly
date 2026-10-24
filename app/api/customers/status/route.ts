import { prisma } from "@/lib/prisma";
import { getCurrentBusinessId } from "@/lib/auth";

const DEAL_STATUSES = [
  "INQUIRY",
  "NEGOTIATING",
  "PAID",
  "DELIVERED",
] as const;

type DealStatus = (typeof DEAL_STATUSES)[number];

function isDealStatus(value: unknown): value is DealStatus {
  return (
    typeof value === "string" &&
    (DEAL_STATUSES as readonly string[]).includes(value)
  );
}

// POST /api/customers/status
// Body: { customerId, businessId, status }. Moves a customer between the CRM
// Kanban columns. The businessId is checked against the session so one tenant
// can never move another tenant's customer.
export async function POST(request: Request) {
  try {
    const sessionBusinessId = await getCurrentBusinessId();
    if (!sessionBusinessId) {
      return Response.json({ error: "Not signed in" }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as {
      customerId?: unknown;
      businessId?: unknown;
      status?: unknown;
    } | null;

    const customerId =
      typeof body?.customerId === "string" ? body.customerId.trim() : "";
    const businessId =
      typeof body?.businessId === "string" ? body.businessId.trim() : "";
    const status = body?.status;

    if (!customerId || !businessId || !isDealStatus(status)) {
      return Response.json(
        {
          error:
            "customerId, businessId and a valid status (INQUIRY|NEGOTIATING|PAID|DELIVERED) are required",
        },
        { status: 400 },
      );
    }

    if (businessId !== sessionBusinessId) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, businessId: sessionBusinessId },
      select: { id: true },
    });

    if (!customer) {
      return Response.json({ error: "Customer not found" }, { status: 404 });
    }

    await prisma.customer.update({
      where: { id: customer.id },
      data: { dealStatus: status },
    });

    return Response.json({ ok: true, dealStatus: status });
  } catch (error) {
    console.error("[POST /api/customers/status]", error);
    return Response.json(
      {
        error: "Failed to update customer status",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
