"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { STAFF_DENIED_MESSAGE } from "@/lib/team";

export type SaveDiscordResult =
  | { ok: true; discordGuildId: string | null }
  | { ok: false; error: string };

/**
 * Save the owner's Discord bot token (and optional server id) to the business.
 * Called from the AI Line settings page. The caller is always resolved from the
 * session, never from the form, so one owner cannot touch another tenant.
 */
export async function saveDiscordBotToken(input: {
  botToken?: unknown;
  guildId?: unknown;
}): Promise<SaveDiscordResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "You need to sign in to connect Discord." };
  }

  // Team Collaboration: the Discord bot token is the business's channel, so
  // only the owner may set it. Server actions are POSTs to the page they are
  // used from, which the proxy does not gate — the role check has to be here.
  if (user.role !== "OWNER") {
    return { ok: false, error: STAFF_DENIED_MESSAGE };
  }

  const botToken =
    typeof input?.botToken === "string" ? input.botToken.trim() : "";
  const guildId =
    typeof input?.guildId === "string" ? input.guildId.trim() : "";

  if (!botToken) {
    return { ok: false, error: "Discord bot token is required." };
  }

  if (guildId && !/^\d{5,25}$/.test(guildId)) {
    return {
      ok: false,
      error:
        "Discord server id is numbers only. Enable Developer Mode in Discord, right-click your server, and copy the server id.",
    };
  }

  try {
    const business = await prisma.business.update({
      where: { id: user.businessId },
      data: {
        discordBotToken: botToken,
        discordGuildId: guildId || null,
      },
      select: { discordGuildId: true },
    });

    return { ok: true, discordGuildId: business.discordGuildId };
  } catch (error) {
    console.error("[saveDiscordBotToken]", error);
    return {
      ok: false,
      error: "Could not save your Discord settings. Please try again.",
    };
  }
}
