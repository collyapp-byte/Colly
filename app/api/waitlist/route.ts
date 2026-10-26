import { prisma } from "@/lib/prisma";
import { getCurrentBusinessId } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

/** Digits, spaces, dashes and a leading + only; 7–20 characters of digits. */
function normalizeNumber(value: string): string | null {
  const trimmed = value.trim();
  if (!/^\+?[\d\s-]+$/.test(trimmed)) return null;

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 20) return null;

  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

// GET /api/waitlist
// Whether the signed-in business is already on the manual WhatsApp waitlist.
export async function GET() {
  try {
    const businessId = await getCurrentBusinessId();
    if (!businessId) {
      return Response.json({ error: "Not signed in" }, { status: 401 });
    }

    const entry = await prisma.whatsappWaitlist.findFirst({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      select: { whatsappNumber: true, createdAt: true },
    });

    return Response.json({
      onWaitlist: entry !== null,
      whatsappNumber: entry?.whatsappNumber ?? null,
      joinedAt: entry?.createdAt ?? null,
    });
  } catch (error) {
    console.error("[GET /api/waitlist]", error);
    return Response.json(
      { error: "Failed to load the waitlist status" },
      { status: 500 },
    );
  }
}

// POST /api/waitlist
// Body: { whatsappNumber: string }. Adds the business to the manual WhatsApp
// onboarding waitlist. Also works signed-out (businessId stays null), which is
// how the marketing page can collect numbers before signup.
export async function POST(request: Request) {
  try {
    // Cheap abuse guard: the endpoint is public and writes rows. In-memory per
    // instance, which is enough to stop casual scripts (see the QA audit for the
    // shared-store follow-up).
    if (!checkRateLimit(`waitlist:${clientIp(request)}`, 5, 10 * 60 * 1000)) {
      return Response.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 },
      );
    }

    const body = await request.json().catch(() => null);
    const raw =
      typeof (body as { whatsappNumber?: unknown } | null)?.whatsappNumber ===
      "string"
        ? ((body as { whatsappNumber: string }).whatsappNumber)
        : "";

    const whatsappNumber = normalizeNumber(raw);
    if (!whatsappNumber) {
      return Response.json(
        { error: "Enter a valid WhatsApp number, e.g. +2348012345678." },
        { status: 400 },
      );
    }

    const businessId = await getCurrentBusinessId();

    // Dedupe: one row per business + number, so a double click or a re-submit
    // does not queue the same shop twice.
    const existing = await prisma.whatsappWaitlist.findFirst({
      where: { businessId, whatsappNumber },
      select: { id: true },
    });

    if (existing) {
      return Response.json({ ok: true, alreadyOnList: true });
    }

    await prisma.whatsappWaitlist.create({
      data: { whatsappNumber, businessId },
    });

    return Response.json({ ok: true, alreadyOnList: false });
  } catch (error) {
    console.error("[POST /api/waitlist]", error);
    return Response.json(
      {
        error: "Failed to join the waitlist",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
