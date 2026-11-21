"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Marks every notification for the business as read (stamps
 * `business.lastNotificationsReadAt`) and refreshes the page so the header
 * bell dot and the home top banner disappear immediately.
 */
export function MarkAllDoneButton() {
  const router = useRouter();
  const [marking, setMarking] = useState(false);

  async function handleMarkAllDone() {
    setMarking(true);
    try {
      const res = await fetch("/api/notifications", { method: "PATCH" });
      if (!res.ok) {
        throw new Error("Could not mark notifications as read");
      }
      router.refresh();
    } finally {
      setMarking(false);
    }
  }

  return (
    <Button
      type="button"
      onClick={handleMarkAllDone}
      disabled={marking}
      size="sm"
    >
      {marking ? (
        <>
          <Check className="h-3.5 w-3.5 mr-1.5 animate-spin" aria-hidden />
          Marking…
        </>
      ) : (
        <>
          <Check className="h-3.5 w-3.5 mr-1.5" aria-hidden />
          Mark all as done
        </>
      )}
    </Button>
  );
}
