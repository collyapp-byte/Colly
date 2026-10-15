"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const START_WIDTH = 15;
const GROW_INTERVAL_MS = 100;
const GROW_STEP = 25;
const MAX_CREEP = 85;
const COMPLETE_DELAY_MS = 150;
const SNAP_MS = 150;
const FADE_MS = 200;

export function TopLoader() {
  const pathname = usePathname();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Phase 1 — a navigation was detected: reveal the bar and creep forward.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- driving UI from route changes */
    setWidth(START_WIDTH);
    setVisible(true);
    /* eslint-enable react-hooks/set-state-in-effect */

    intervalRef.current = setInterval(() => {
      setWidth((current) => (current >= MAX_CREEP ? current : current + GROW_STEP));
    }, GROW_INTERVAL_MS);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [pathname]);

  // Phase 2 — the new route has rendered: snap to full, fade, then reset.
  useEffect(() => {
    let snapTimer: ReturnType<typeof setTimeout> | undefined;
    let fadeTimer: ReturnType<typeof setTimeout> | undefined;

    const completeTimer = setTimeout(() => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setWidth(100);
      snapTimer = setTimeout(() => {
        setVisible(false);
        fadeTimer = setTimeout(() => setWidth(0), FADE_MS);
      }, SNAP_MS);
    }, COMPLETE_DELAY_MS);

    return () => {
      clearTimeout(completeTimer);
      if (snapTimer !== undefined) clearTimeout(snapTimer);
      if (fadeTimer !== undefined) clearTimeout(fadeTimer);
    };
  }, [pathname]);

  return (
    <div
      aria-hidden
      className="fixed left-0 right-0 top-0 z-[200] h-0.5 bg-[#FF6600]"
      style={{
        width: `${width}%`,
        opacity: visible ? 1 : 0,
        pointerEvents: "none",
        boxShadow: "0 0 8px rgba(255,102,0,0.6)",
        transition: "width 150ms ease-out, opacity 200ms ease-out",
      }}
    />
  );
}
