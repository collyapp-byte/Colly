"use client";

import Link from "next/link";
import { AlertCircle, X } from "lucide-react";

type AiPausedBannerProps = {
  reason: "plan_expired" | "cap_hit" | "no_credits";
  used?: number;
  cap?: number;
  onDismiss?: () => void;
};

export function AiPausedBanner({
  reason,
  used = 0,
  cap = 0,
  onDismiss,
}: AiPausedBannerProps) {
  const getMessage = () => {
    switch (reason) {
      case "plan_expired":
        return "Your trial has ended. Subscribe to restore AI replies.";
      case "cap_hit":
        return `You've used ${used.toLocaleString()}/${cap.toLocaleString()} messages this month. Buy credits or upgrade.`;
      case "no_credits":
        return "You're out of credits. Buy more to keep AI replying.";
      default:
        return "AI replies are paused.";
    }
  };

  return (
    <div
      className="relative mb-4 rounded-lg border border-[#FF6600]/30 bg-[#FFF4EC] p-4"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#FF6600]" aria-hidden />
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900">{getMessage()}</p>
          <Link
            href="/settings/billing"
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[#FF6600] hover:underline"
          >
            View billing →
          </Link>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 text-gray-400 hover:text-gray-600"
            aria-label="Dismiss"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}