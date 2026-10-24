import { prisma } from "@/lib/prisma";
import { getCurrentBusinessId } from "@/lib/auth";

// POST /api/waitlist
// Body: { whatsappNumber: string }. Adds the business to the manual WhatsApp
// onboarding waitlist. Works signed-out too (businessId stays null).
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      whatsappNumber?: unknown;
    } | null;

    const whatsappNumber =
      typeof body?.whatsappNumber === "string"
        ? body.whatsappNumber.trim()
        : "";

    if (!whatsappNumber) {
      return Response.json(
        { error: "WhatsApp number is required" },
        { status: 400 },
      );
    }

    const businessId = await getCurrentBusinessId();

    await prisma.whatsappWaitlist.create({
      data: { whatsappNumber, businessId },
    });

    return Response.json({ ok: true });
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
