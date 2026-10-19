import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

type WhatsappConnectBody = {
  phoneNumber?: unknown;
};

function badRequest(error: string) {
  return Response.json({ error }, { status: 400 });
}

// POST /api/whatsapp/connect
// The owner submits the WhatsApp number they want Colly's AI to answer. There
// is no self-serve Gupshup signup yet: the number is stored on the business
// and the row is flagged PENDING_BSP_SETUP, which the AI Line page reads as
// "our team will finish the BSP onboarding within 24 hours".
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: "Not signed in" }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as
      | WhatsappConnectBody
      | null;
    const phoneNumber =
      typeof body?.phoneNumber === "string" ? body.phoneNumber.trim() : "";
    if (!phoneNumber) {
      return badRequest("WhatsApp phone number is required");
    }

    const digits = phoneNumber.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15) {
      return badRequest("Enter a valid WhatsApp phone number");
    }

    const business = await prisma.business.findUnique({
      where: { id: user.businessId },
      select: { id: true, channel: true },
    });
    if (!business) {
      return Response.json({ error: "Business not found" }, { status: 404 });
    }
    if (business.channel !== "WHATSAPP") {
      return badRequest(
        "This business is set up for Telegram. Change your channel before starting WhatsApp setup.",
      );
    }

    await prisma.business.update({
      where: { id: business.id },
      data: {
        whatsappNumber: phoneNumber,
        connectionStatus: "PENDING_BSP_SETUP",
      },
    });

    return Response.json({ ok: true, connectionStatus: "PENDING_BSP_SETUP" });
  } catch (error) {
    console.error("[POST /api/whatsapp/connect]", error);
    return Response.json(
      { error: "Could not save your number. Please try again." },
      { status: 500 },
    );
  }
}
