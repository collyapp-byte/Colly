import { getCurrentBusinessId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bookingEndTime, serializeBooking } from "@/lib/bookings";
import { parseLagosDateTime } from "@/lib/timezone";

type BookingRequestBody = {
  customerId?: unknown;
  serviceName?: unknown;
  startTime?: unknown;
  notes?: unknown;
};

/** Longest service label the dashboard renders on one line. */
const SERVICE_NAME_MAX_LENGTH = 120;

/** Free-text notes are capped so one request cannot store a wall of text. */
const NOTES_MAX_LENGTH = 1000;

function badRequest(error: string) {
  return Response.json({ error }, { status: 400 });
}

function notFound(error: string) {
  return Response.json({ error }, { status: 404 });
}

function unauthorized() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}

// POST /api/bookings
// Body: { customerId, serviceName, startTime, notes? }
//
// Books a slot for one of the signed-in business's customers and returns the
// created booking. `startTime` is an ISO 8601 date-time: a value with an offset
// ("2026-11-03T10:00:00+01:00", "...Z") is taken as written, a zone-less one
// ("2026-11-03T10:00") is read as Africa/Lagos wall clock — see
// lib/timezone.ts#parseLagosDateTime. Either way the instant is stored in UTC
// (`TIMESTAMPTZ`) and echoed back with its Lagos rendering.
//
// `endTime` is one hour after the start (lib/bookings.ts#bookingEndTime), and
// `status` is left to the schema default of PENDING: only the owner confirms.
export async function POST(request: Request) {
  try {
    const businessId = await getCurrentBusinessId();

    if (!businessId) {
      return unauthorized();
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return badRequest("Invalid JSON body");
    }

    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      return badRequest("Expected a JSON object");
    }

    const body = raw as BookingRequestBody;

    const customerId =
      typeof body.customerId === "string" ? body.customerId.trim() : "";
    if (!customerId) {
      return badRequest("customerId is required");
    }

    const serviceName =
      typeof body.serviceName === "string" ? body.serviceName.trim() : "";
    if (!serviceName) {
      return badRequest("serviceName is required");
    }
    if (serviceName.length > SERVICE_NAME_MAX_LENGTH) {
      return badRequest(
        `serviceName must be ${SERVICE_NAME_MAX_LENGTH} characters or fewer`,
      );
    }

    // Notes are optional free text: absent, null or blank all mean "no notes".
    let notes: string | null = null;
    if (body.notes !== undefined && body.notes !== null) {
      if (typeof body.notes !== "string") {
        return badRequest("notes must be a string");
      }
      const trimmed = body.notes.trim();
      if (trimmed.length > NOTES_MAX_LENGTH) {
        return badRequest(
          `notes must be ${NOTES_MAX_LENGTH} characters or fewer`,
        );
      }
      notes = trimmed || null;
    }

    if (typeof body.startTime !== "string") {
      return badRequest(
        "startTime must be an ISO 8601 date-time string, e.g. 2026-11-03T10:00:00+01:00",
      );
    }

    const startTime = parseLagosDateTime(body.startTime);
    if (!startTime) {
      return badRequest(
        "startTime is not a valid date-time. Send an ISO 8601 value with a time; a value without an offset (2026-11-03T10:00) is read as Africa/Lagos time.",
      );
    }

    // Tenant check: a booking may only ever point at this business's customer,
    // so a guessed id from another tenant is a 404, never a cross-tenant row.
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, businessId },
      select: { id: true },
    });
    if (!customer) {
      return notFound("Customer not found");
    }

    const booking = await prisma.booking.create({
      data: {
        businessId,
        customerId: customer.id,
        serviceName,
        startTime,
        endTime: bookingEndTime(startTime),
        notes,
      },
    });

    return Response.json({ booking: serializeBooking(booking) }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/bookings]", error);
    return Response.json(
      {
        error: "Failed to create booking",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
