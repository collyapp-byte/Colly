"use client";

import type { ComponentType, ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ChannelStatusTone } from "@/lib/channels";

/**
 * The card shell every channel on `/channels` uses.
 *
 * At rest a card is one scannable row: icon, title, live status badge, a single
 * line of copy and the credit cost. The setup inputs live in `children`, which
 * only mounts while the card is expanded -- that is the progressive disclosure
 * the hub is built on, so no card opens with a wall of instructions.
 *
 * The header is a real button (`aria-expanded` + `aria-controls`), so the whole
 * top half of the card is one large, keyboard-reachable target on mobile.
 */

const TONE_CLASS: Record<ChannelStatusTone, string> = {
  positive: "border-colly/25 bg-colly-tint text-colly",
  waiting: "border-amber-500/30 bg-amber-500/10 text-amber-700",
  problem: "border-amber-500/40 bg-amber-500/15 text-amber-800",
  neutral: "border-card-border bg-surface-muted text-muted",
};

/** The small status pill a card (and a setup panel) shows. */
export function ChannelStatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: ChannelStatusTone;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${TONE_CLASS[tone]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {label}
    </span>
  );
}

export type ChannelCardProps = {
  /** Used for the panel's DOM id, so the toggle can point at it. */
  id: string;
  title: string;
  icon: ComponentType<{ className?: string }>;
  description: string;
  statusLabel: string;
  statusTone: ChannelStatusTone;
  /** Extra live detail under the description, e.g. "@my_bot" or a phone number. */
  statusDetail?: string | null;
  /** The cost pill: "80 credits / AI reply". */
  creditLabel: string;
  /** Connect / Manage / Customize. */
  actionLabel: string;
  expanded: boolean;
  onToggle: () => void;
  /** Shown instead of the setup panel for a channel only the owner may change. */
  locked?: boolean;
  /** Copy explaining a locked card. */
  lockedMessage?: string;
  children: ReactNode;
};

export function ChannelCard({
  id,
  title,
  icon: Icon,
  description,
  statusLabel,
  statusTone,
  statusDetail = null,
  creditLabel,
  actionLabel,
  expanded,
  onToggle,
  locked = false,
  lockedMessage = "Only the business owner can change this channel.",
  children,
}: ChannelCardProps) {
  const panelId = `channel-panel-${id}`;

  return (
    <article
      className={`surface-card self-start flex flex-col overflow-hidden ${
        expanded ? "border-colly/35" : ""
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="surface-card-interactive group flex w-full items-start gap-3 p-4 text-left duration-250 ease-out sm:p-5"
      >
        <span className="flex h-10 w-10 shrink-0 rounded-xl bg-colly-tint text-colly ring-1 ring-colly/15 transition-transform duration-250 group-hover:scale-105 overflow-hidden">
          <Icon className="h-full w-full" aria-hidden />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-main">{title}</span>
            <ChannelStatusBadge label={statusLabel} tone={statusTone} />
          </span>
          <span className="mt-1 block text-xs leading-relaxed text-muted">
            {description}
          </span>
          {statusDetail ? (
            <span className="mt-1 block truncate text-xs font-medium text-main">
              {statusDetail}
            </span>
          ) : null}
          <span className="mt-2.5 inline-flex items-center rounded-full border border-card-border bg-surface-muted px-2.5 py-0.5 text-[11px] font-medium text-muted">
            {creditLabel}
          </span>
        </span>

        <ChevronDown
          className={`mt-1 h-4 w-4 shrink-0 text-muted transition-transform duration-250 ${
            expanded ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>

      <div className="mt-auto flex flex-col gap-2 px-4 pb-4 sm:px-5 sm:pb-5">
        {locked ? (
          <p className="text-xs leading-relaxed text-muted">{lockedMessage}</p>
        ) : null}
        <Button
          type="button"
          variant={expanded ? "secondary" : "primary"}
          size="sm"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="w-full"
        >
          {actionLabel}
        </Button>
      </div>

      {expanded ? (
        <div
          id={panelId}
          role="region"
          aria-label={`${title} setup`}
          className="border-t border-card-border/70 bg-surface-muted/30 p-4 sm:p-5"
        >
          {children}
        </div>
      ) : null}
    </article>
  );
}
