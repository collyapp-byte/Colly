import { connection } from "next/server";
import type { Metadata } from "next";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  CHANNEL_QUERY_PARAM,
  isChannelKey,
  whatsappSessionViewFromRow,
} from "@/lib/channels";
import { ChannelsHub } from "@/components/channels/channels-hub";

export const metadata: Metadata = {
  title: "Channels",
};

/**
 * The Channels hub.
 *
 * Owner and staff alike may open it: knowing whether WhatsApp is paired and
 * whether the Telegram bot is live is day-to-day information. Acting on it is
 * not — the setup panels hide owner-only controls and every mutation API is
 * guarded by `requireOwnerApi()` / a role check (the proxy skips `/api`).
 *
 * A Server Component so the first paint already carries the true statuses:
 * `connection()` keeps the per-tenant read out of the prerender, exactly like
 * the bookings diary. The WhatsApp snapshot is computed with the same
 * 45-second rule the polling route applies, so a dead pairing service reads as
 * "No response" immediately instead of after a client round trip.
 */
export default async function ChannelsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection(); // prerendering stops here

  const user = await requireAuth();

  const [business, session, params] = await Promise.all([
    prisma.business.findUnique({
      where: { id: user.businessId },
      select: {
        id: true,
        name: true,
        telegramBotToken: true,
        telegramBotUsername: true,
        discordBotToken: true,
        discordGuildId: true,
        ownerTelegramChatId: true,
      },
    }),
    prisma.whatsAppSession.findUnique({
      where: { businessId: user.businessId },
      select: {
        status: true,
        qrCode: true,
        phoneNumber: true,
        updatedAt: true,
      },
    }),
    searchParams,
  ]);

  if (!business) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="font-display text-2xl text-main sm:text-3xl">Channels</h1>
        <p className="mt-1 text-sm text-muted">
          We could not load your business. Refresh the page, or contact support
          if this keeps happening.
        </p>
      </div>
    );
  }

  const requested = params[CHANNEL_QUERY_PARAM];
  const initialChannel = isChannelKey(requested) ? requested : null;

  return (
    <ChannelsHub
      business={{
        id: business.id,
        name: business.name,
        // Token presence is what `serializeBusiness()` exposes as a booleans;
        // the token itself never crosses to the browser.
        telegramConnected: Boolean(business.telegramBotToken),
        telegramBotUsername: business.telegramBotUsername,
        discordConnected: Boolean(business.discordBotToken),
        discordGuildId: business.discordGuildId ?? null,
        ownerTelegramChatId: business.ownerTelegramChatId,
      }}
      whatsappSession={whatsappSessionViewFromRow(session)}
      isOwner={user.role === "OWNER"}
      initialChannel={initialChannel}
    />
  );
}
