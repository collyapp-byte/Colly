"use client";

import { useEffect, type ReactNode } from "react";
import Lenis from "@studio-freight/lenis";

/**
 * Smooth scrolling for the marketing site, à la Linear/Stripe. Initializes
 * Lenis with a ~1.2s eased scroll and drives it from a rAF loop; destroyed on
 * unmount so hot reloads never leave a zombie instance behind.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  useEffect(() => {
    const lenis = new Lenis({ duration: 1.2 });

    let frame = requestAnimationFrame(function raf(time) {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    });

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
