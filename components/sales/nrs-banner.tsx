"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { Business } from "@/lib/business";

const BANNER_HIDE_MS = 7 * 24 * 60 * 60 * 1000;

type NrsBannerProps = {
  /** The signed-in owner's business (null while it is still loading). */
  business: Business | null;
  /** Open the "Get NRS-Compliant" modal. */
  onOpen: () => void;
  /** Called after a successful dismiss, so the page can re-fetch the business. */
  onDismissed: () => void;
};

/**
 * Informational banner pointing owners at the NRS e-invoicing mandate. It never
 * blocks anything; it simply disappears once the business is set up (Tax ID or
 * exemption on file) or was dismissed within the last 7 days.
 */
export function NrsBanner({ business, onOpen, onDismissed }: NrsBannerProps) {
  const [dismissing, setDismissing] = useState(false);
  const [hidden, setHidden] = useState(false);

  if (hidden || isHidden(business)) {
    return null;
  }

  async function dismiss() {
    if (dismissing) return;
    setDismissing(true);

    try {
      const res = await fetch("/api/business/nrs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dismissed: true }),
      });
      if (res.ok) {
        onDismissed();
      }
    } catch (error) {
      // Dismiss is best-effort: hide the banner locally so the click feels
      // responsive even when the network call fails.
      console.error("[nrs-banner] dismiss failed:", error);
      setHidden(true);
    } finally {
      setDismissing(false);
    }
  }

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 py-2.5 pl-4 pr-2 text-sm text-amber-800">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 text-left font-medium transition-colors hover:text-amber-900"
      >
        <span aria-hidden>⚠️</span>
        <span className="truncate">NRS e-invoicing compliance is coming. Get ready →</span>
      </button>
      <button
        type="button"
        onClick={dismiss}
        disabled={dismissing}
        aria-label="Dismiss"
        title="Dismiss"
        className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-amber-500 transition-colors hover:bg-amber-100 hover:text-amber-800 disabled:opacity-50"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

/** True when the banner should not render. */
function isHidden(business: Business | null): boolean {
  if (!business) return true;
  if (business.nrsTaxId) return true;
  if (business.nrsExemptReason) return true;
  if (business.nrsLastDismissedAt) {
    const dismissedAt = new Date(business.nrsLastDismissedAt).getTime();
    if (Date.now() - dismissedAt < BANNER_HIDE_MS) return true;
  }
  return false;
}