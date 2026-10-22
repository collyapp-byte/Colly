"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export type SaveWhatsAppResult =
  | { ok: true; whatsappPhoneNumberId: string }
  | { ok: false; error: string };

/**
 * Save the owner's Meta WhatsApp Cloud API credentials. Called from the AI
 * Line settings page. The business always comes from the session, never from
 * the form, so the update stays tenant-scoped.
 */
export async function saveWhatsAppSettings(input: {
  phoneNumberId?: unknown;
  accessToken?: unknown;
  verifyToken?: unknown;
}): Promise<SaveWhatsAppResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "You need to sign in to connect WhatsApp." };
  }

  const phoneNumberId =
    typeof input?.phoneNumberId === "string"
      ? input.phoneNumberId.trim()
      : "";
  const accessToken =
    typeof input?.accessToken === "string" ? input.accessToken.trim() : "";
  const verifyToken =
    typeof input?.verifyToken === "string" ? input.verifyToken.trim() : "";

  if (!phoneNumberId) {
    return { ok: false, error: "WhatsApp phone number id is required." };
  }
  if (!/^\d{5,25}$/.test(phoneNumberId)) {
    return {
      ok: false,
      error:
        "Phone number id is numbers only. Copy it from the Meta Developer Dashboard.",
    };
  }
  if (!accessToken) {
    return { ok: false, error: "WhatsApp access token is required." };
  }
  if (!verifyToken) {
    return { ok: false, error: "WhatsApp verify token is required." };
  }
  if (verifyToken.length < 8) {
    return {
      ok: false,
      error: "Use a verify token of at least 8 characters.",
    };
  }

  try {
    await prisma.business.update({
      where: { id: user.businessId },
      data: {
        whatsappPhoneNumberId: phoneNumberId,
        whatsappAccessToken: accessToken,
        whatsappVerifyToken: verifyToken,
        connectionStatus: "CONNECTED",
      },
    });

    return { ok: true, whatsappPhoneNumberId: phoneNumberId };
  } catch (error) {
    console.error("[saveWhatsAppSettings]", error);
    return {
      ok: false,
      error: "Could not save your WhatsApp settings. Please try again.",
    };
  }
}
