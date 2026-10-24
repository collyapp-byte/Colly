"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * The Notifications page marks itself read on the server. A client navigation
 * keeps the shared dashboard layout mounted, so trigger one soft refresh to
 * recalculate the unread bell badge without a full page reload.
 */
export function RefreshOnMount() {
  const router = useRouter();
  const refreshed = useRef(false);

  useEffect(() => {
    if (refreshed.current) return;
    refreshed.current = true;
    router.refresh();
  }, [router]);

  return null;
}
