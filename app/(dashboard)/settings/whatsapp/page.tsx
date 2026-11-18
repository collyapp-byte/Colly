"use client";

import Link from "next/link";
import { ArrowLeft, Cable } from "lucide-react";

import { ChannelStatusBadge } from "@/components/channels/channel-card";
import { WhatsAppPanel } from "@/components/channels/whatsapp-panel";
import {
  PAIRING_TIMEOUT_SECONDS,
  useWhatsAppSession,
} from "@/components/channels/use-whatsapp-session";
import { whatsappStatusLabel, whatsappStatusTone } from "@/lib/channels";
import { REPLY_CREDIT_COSTS } from "@/lib/plans";

const SECTION_CLASS = "surface-card p-5 sm:p-6";
const HEADING_CLASS = "font-display text-base tracking-wide text-main";

/**
 * Settings → WhatsApp.
 *
 * Kept alive for bookmarks and for anyone who lands here from the old sidebar
 * row, but the pairing UI itself now lives in `components/channels` and is
 * shared with `/channels` — one hook, one panel, so the QR code, the 45-second
 * timeout, Retry / Reconnect and Disconnect behave identically on both screens.
 */
export default function WhatsAppSettingsPage() {
  const state = useWhatsAppSession();

  const status = state.session?.status ?? "DISCONNECTED";
  const stalled = state.session?.stalled === true;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-all duration-250 hover:text-colly"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to settings
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl text-main">WhatsApp</h1>
          {state.session ? (
            <ChannelStatusBadge
              label={whatsappStatusLabel(status, stalled)}
              tone={whatsappStatusTone(status, stalled)}
            />
          ) : null}
        </div>
        <p className="mt-1 text-sm text-muted">
          Pair the number your customers chat with. Colly answers on that line
          from your catalogue and tone, and hands the conversation to you when
          it should.
        </p>
        <Link
          href="/channels"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-colly transition-all duration-250 hover:underline"
        >
          <Cable className="h-4 w-4" aria-hidden />
          Manage every channel in one place
        </Link>
      </div>

      <section className={SECTION_CLASS} aria-live="polite">
        <WhatsAppPanel state={state} isOwner />
      </section>

      <section className={SECTION_CLASS}>
        <h2 className={HEADING_CLASS}>GOOD TO KNOW</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted">
          <li>
            A WhatsApp AI reply costs {REPLY_CREDIT_COSTS.whatsapp} credits,
            against {REPLY_CREDIT_COSTS.standard} on Telegram, Discord and web
            chat, so keep an eye on your balance.
          </li>
          <li>Only the business owner can pair or disconnect the line.</li>
          <li>
            If the phone stays offline for too long WhatsApp unlinks the device.
            Pair it again from this page.
          </li>
          <li>
            No QR code after {PAIRING_TIMEOUT_SECONDS} seconds means the pairing
            service is offline. Press Retry / Reconnect, or come back later —
            your other channels keep working.
          </li>
        </ul>
      </section>
    </div>
  );
}
