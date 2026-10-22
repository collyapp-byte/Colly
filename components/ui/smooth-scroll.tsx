"use client";

import { useEffect, type ReactNode } from "react";
import Lenis from "@studio-freight/lenis";

/**
 * Smooth scrolling for the marketing site, à la Linear/Stripe. Lenis is only
 * initialized on desktop: on phones and tablets its rAF loop competes with
 * touch scrolling and causes visible lag, so those devices keep the browser's
 * native scrolling. The media query is live, so a resize across the breakpoint
 * starts or stops Lenis without a reload.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    let lenis: Lenis | null = null;
    let frame = 0;

    const stop = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      lenis?.destroy();
      lenis = null;
    };

    const start = () => {
      if (lenis) return;
      const instance = new Lenis({ duration: 1.2 });
      lenis = instance;

      const raf = (time: number) => {
        instance.raf(time);
        frame = requestAnimationFrame(raf);
      };
      frame = requestAnimationFrame(raf);
    };

    const sync = () => {
      if (query.matches) {
        start();
      } else {
        stop();
      }
    };

    sync();
    query.addEventListener("change", sync);

    return () => {
      query.removeEventListener("change", sync);
      stop();
    };
  }, []);

  return <>{children}</>;
}
