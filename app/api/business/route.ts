import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  INDUSTRIES,
  isIndustry,
  isTone,
  serializeBusiness,
  TONES,
} from "@/lib/business";
import { STAFF_DENIED_MESSAGE, STAFF_DENIED_VALUE } from "@/lib/team";
import { isPublicStorageUrl } from "@/lib/supabase/storage-path";

type BusinessRequestBody = {
  name?: unknown;
  phone?: unknown;
  whatsappNumber?: unknown;
  tone?: unknown;
  industry?: unknown;
  businessHours?: unknown;
  address?: unknown;
  description?: unknown;
  paymentInstructions?: unknown;
  avatarUrl?: unknown;
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
    // when any channel credential is stored.
    const [productsCount, faqsCount] = await Promise.all([
      prisma.product.count({ where: { businessId: user.businessId } }),
      prisma.faq.count({ where: { businessId: user.businessId } }),
    ]);

    const pendingTasks: string[] = [];
    if (!business.telegramBotToken && !business.discordBotToken) {
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
      // OWNER or STAFF — the Settings page uses it to keep owner-only cards
      // (team management, billing) out of a staff member's view.
      role: user.role,
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
      industry?: string;
      businessHours?: string | null;
      address?: string | null;
      description?: string | null;
      paymentInstructions?: string | null;
      avatarUrl?: string | null;
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

    // The vertical. It selects the AI persona (lib/chat-engine.ts appends the
    // hotel block for "HOTEL"), so an unknown value is rejected rather than
    // stored — `serializeBusiness` would read it back as RETAIL and the owner
    // would think the change had saved.
    if (body.industry !== undefined) {
      if (!isIndustry(body.industry)) {
        return badRequest(`Industry must be one of: ${INDUSTRIES.join(", ")}`);
      }
      data.industry = body.industry;
    }

    // Optional free-text fields: an empty string clears them (stored as null).
    for (const field of [
      "businessHours",
      "address",
      "description",
      "paymentInstructions",
    ] as const) {
      const value = body[field];
      if (value === undefined) continue;
      if (typeof value !== "string") {
        return badRequest(`${field} must be a string`);
      }
      data[field] = value.trim() || null;
    }

    // Business profile picture (web chat header). The browser uploads the file to
    // Storage first (`uploadBusinessAvatar()`), so this field is always a URL —
    // never file bytes. Validated twice on purpose:
    //
    // 1. `isPublicStorageUrl()` — an https public object in THIS project's
    //    Supabase Storage, exactly the shape the upload helper returns. A crafted
    //    body cannot make the public widget load an arbitrary remote image
    //    (which would leak every visitor's IP to a third party), and it cannot
    //    point at `javascript:`/`data:`/`http:`.
    // 2. the `/{businessId}/` prefix — the picture must be the caller's own
    //    upload, not another tenant's product photo or (worse) a customer's
    //    receipt in the `receipts` bucket.
    //
    // An empty string clears the picture so the widget falls back to the initial.
    if (body.avatarUrl !== undefined) {
      if (typeof body.avatarUrl !== "string") {
        return badRequest("avatarUrl must be a string");
      }
      const avatarUrl = body.avatarUrl.trim();

      if (!avatarUrl) {
        data.avatarUrl = null;
      } else {
        if (!isPublicStorageUrl(avatarUrl)) {
          return badRequest(
            "Profile picture must be uploaded through Colly. Use the upload button on this page.",
          );
        }
        if (!new URL(avatarUrl).pathname.includes(`/${user.businessId}/`)) {
          return badRequest("Profile picture must belong to your own business.");
        }
        data.avatarUrl = avatarUrl;
      }
    }

    // The owner's personal Telegram chat id (from @userinfobot): digits with an
    // optional leading minus (group chats are negative). Empty clears it.
    //
    // Owner alerts go to this chat, so it is the owner's to set: a staff account
    // must not be able to re-point the owner's notifications at a chat it
    // controls (or silence them by clearing the field).
    if (body.ownerTelegramChatId !== undefined) {
      if (user.role !== "OWNER") {
        return Response.json(
          { error: STAFF_DENIED_MESSAGE, reason: STAFF_DENIED_VALUE },
          { status: 403 },
        );
      }

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
