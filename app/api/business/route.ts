import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isTone, serializeBusiness, TONES } from "@/lib/business";

type BusinessRequestBody = {
  name?: unknown;
  phone?: unknown;
  whatsappNumber?: unknown;
  tone?: unknown;
  businessHours?: unknown;
  address?: unknown;
  description?: unknown;
  ownerTelegramChatId?: unknown;
};

function badRequest(error: string) {
  return Response.json({ error }, { status: 400 });
}

function unauthorized() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}

// GET /api/business
// The signed-in owner's business profile, plus the owner's email so the
// Settings page can show it without a second round trip.
export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return unauthorized();
    }

    const business = await prisma.business.findUnique({
      where: { id: user.businessId },
    });

    if (!business) {
      return Response.json({ error: "Business not found" }, { status: 404 });
    }

    // Onboarding checklist, surfaced as an orange dot in the sidebar and used
    // to highlight the relevant settings card. A channel counts as connected
    // when the Telegram bot token is set (WhatsApp self-serve setup is paused
    // until Meta verification clears).
    const [productsCount, faqsCount] = await Promise.all([
      prisma.product.count({ where: { businessId: user.businessId } }),
      prisma.faq.count({ where: { businessId: user.businessId } }),
    ]);

    const pendingTasks: string[] = [];
    if (!business.telegramBotToken) {
      pendingTasks.push("Connect a channel");
    }
    if (!business.ownerTelegramChatId) {
      pendingTasks.push("Setup Owner Notifications");
    }
    if (productsCount === 0) {
      pendingTasks.push("Add your first product");
    }
    if (faqsCount === 0) {
      pendingTasks.push("Add FAQs");
    }

    // Owner display name: real name when set, else the email prefix for rows
    // created before the name column was used (the sidebar shows "…" until
    // this loads).
    const emailPrefix = user.email.split("@")[0] || user.email;
    const fallbackName =
      emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
    const ownerName = user.name?.trim() || fallbackName;

    return Response.json({
      business: serializeBusiness(business),
      ownerEmail: user.email,
      ownerName,
      businessName: business.name,
      pendingTasks,
    });
  } catch (error) {
    console.error("[GET /api/business]", error);
    return Response.json(
      {
        error: "Failed to load business",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// PATCH /api/business
// Updates the signed-in owner's business. Any subset of the editable fields may
// be sent; only the keys present in the body are changed, and the update is
// always scoped to the caller's own business id (never one from the body).
export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return unauthorized();
    }

    const body = (await request.json()) as BusinessRequestBody;

    const data: {
      name?: string;
      phone?: string;
      whatsappNumber?: string;
      tone?: string;
      businessHours?: string | null;
      address?: string | null;
      description?: string | null;
      ownerTelegramChatId?: string | null;
    } = {};

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        return badRequest("Business name is required");
      }
      data.name = body.name.trim();
    }

    if (body.phone !== undefined) {
      if (typeof body.phone !== "string" || !body.phone.trim()) {
        return badRequest("Phone number is required");
      }
      data.phone = body.phone.trim();
    }

    if (body.whatsappNumber !== undefined) {
      if (typeof body.whatsappNumber !== "string" || !body.whatsappNumber.trim()) {
        return badRequest("WhatsApp number is required");
      }
      data.whatsappNumber = body.whatsappNumber.trim();
    }

    if (body.tone !== undefined) {
      if (!isTone(body.tone)) {
        return badRequest(`Tone must be one of: ${TONES.join(", ")}`);
      }
      data.tone = body.tone;
    }

    // Optional free-text fields: an empty string clears them (stored as null).
    for (const field of ["businessHours", "address", "description"] as const) {
      const value = body[field];
      if (value === undefined) continue;
      if (typeof value !== "string") {
        return badRequest(`${field} must be a string`);
      }
      data[field] = value.trim() || null;
    }

    // The owner's personal Telegram chat id (from @userinfobot): digits with an
    // optional leading minus (group chats are negative). Empty clears it.
    if (body.ownerTelegramChatId !== undefined) {
      if (typeof body.ownerTelegramChatId !== "string") {
        return badRequest("ownerTelegramChatId must be a string");
      }
      const chatId = body.ownerTelegramChatId.trim();
      if (chatId && !/^-?\d+$/.test(chatId)) {
        return badRequest(
          "Telegram chat ID is numbers only. Message @userinfobot on Telegram to get yours.",
        );
      }
      data.ownerTelegramChatId = chatId || null;
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
    console.error("[PATCH /api/business]", error);
    return Response.json(
      {
        error: "Failed to update business",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
