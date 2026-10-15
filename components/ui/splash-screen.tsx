"use client";

import { useEffect, useState } from "react";
import { LoadingLogo } from "@/components/ui/loading-logo";

const SPLASH_KEY = "colly_splash_shown";
const HOLD_MS = 500;
const FADE_MS = 200;

export function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(SPLASH_KEY)) {
      // First paint matches the server (visible); hide once we know the splash
      // already ran this session. Syncing from sessionStorage on mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(false);
      return;
    }

    let fadeTimer: ReturnType<typeof setTimeout> | undefined;

    const holdTimer = setTimeout(() => {
      sessionStorage.setItem(SPLASH_KEY, "1");
      setFading(true);
      fadeTimer = setTimeout(() => setVisible(false), FADE_MS);
    }, HOLD_MS);

    return () => {
      clearTimeout(holdTimer);
      if (fadeTimer !== undefined) clearTimeout(fadeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-white transition-opacity duration-200 ${
        fading ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <LoadingLogo size="lg" />
    </div>
  );
}
