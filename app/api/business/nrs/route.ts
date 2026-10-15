import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serializeBusiness } from "@/lib/business";

type NrsRequestBody = {
  nrsTaxId?: unknown;
  nrsExemptReason?: unknown;
  dismissed?: unknown;
};

function badRequest(error: string) {
  return Response.json({ error }, { status: 400 });
}

function unauthorized() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}

// PATCH /api/business/nrs
// Body: { nrsTaxId?, nrsExemptReason?, dismissed? }
//
// Updates the Business's NRS e-invoicing compliance state. Submitting an NRS
// Tax ID also stamps `nrsRegistrationDate` with now; `dismissed: true` records
// when the owner last hid the "Get NRS-compliant" banner.
export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return unauthorized();
    }

    const body = (await request.json()) as NrsRequestBody;

    const data: {
      nrsTaxId?: string;
      nrsRegistrationDate?: Date;
      nrsExemptReason?: string | null;
      nrsLastDismissedAt?: Date;
    } = {};

    if (body.nrsTaxId !== undefined) {
      if (typeof body.nrsTaxId !== "string" || !body.nrsTaxId.trim()) {
        return badRequest("NRS Tax ID must be a non-empty string");
      }
      data.nrsTaxId = body.nrsTaxId.trim();
      data.nrsRegistrationDate = new Date();
    }

    if (body.nrsExemptReason !== undefined) {
      if (body.nrsExemptReason === null) {
        data.nrsExemptReason = null;
      } else if (
        body.nrsExemptReason === "handled_by_accountant" ||
        body.nrsExemptReason === "exempt"
      ) {
        data.nrsExemptReason = body.nrsExemptReason;
      } else {
        return badRequest(
          'nrsExemptReason must be "handled_by_accountant", "exempt" or null',
        );
      }
    }

    if (body.dismissed !== undefined) {
      if (body.dismissed !== true && body.dismissed !== false) {
        return badRequest("dismissed must be a boolean");
      }
      if (body.dismissed) {
        data.nrsLastDismissedAt = new Date();
      }
    }

    if (Object.keys(data).length === 0) {
      return badRequest("No fields to update");
    }

    const business = await prisma.business.update({
      where: { id: user.businessId },
      data,
    });

    return Response.json({ business: serializeBusiness(business) });
  } catch (error) {
    console.error("[PATCH /api/business/nrs]", error);
    return Response.json(
      {
        error: "Failed to update NRS settings",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}