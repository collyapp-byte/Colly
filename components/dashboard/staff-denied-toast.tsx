"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { STAFF_DENIED_MESSAGE } from "@/lib/team";

/**
 * The "owner only" toast raised after the proxy bounces an invited STAFF
 * account off an owner-only settings page (`OWNER_ONLY_PATHS`).
 *
 * The proxy only redirects, it never renders, so the message travels as the
 * `?denied=staff_restricted` flag on `/dashboard`; the overview page reads the
 * flag and mounts this component. Kept separate from the page so the
 * dashboard's server half stays free of client-only side effects.
 *
 * The fixed toast id makes React's development double-mount (and any duplicate
 * render) show the message once.
 */
export function StaffDeniedToast() {
  useEffect(() => {
    toast.error(STAFF_DENIED_MESSAGE, { id: "staff-restricted" });
  }, []);

  return null;
}
