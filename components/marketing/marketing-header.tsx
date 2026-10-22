"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { NavbarAuthActions } from "@/components/marketing/navbar-auth-actions";

/**
 * Marketing site header. Glassmorphism variant: fully transparent while the
 * page sits at the top so the hero shows through, then a frosted white panel
 * with a backdrop blur once the visitor scrolls. Scroll position is tracked on
 * the client, so the header is its own Client Component and the rest of the
 * layout stays a Server Component.
 */

/** Scroll offset (px) at which the header swaps to its frosted state. */
const SCROLL_THRESHOLD = 20;

export function MarketingHeader() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      setScrollY(window.scrollY);
    };

    // rAF-throttled so a fast scroll does not queue a state update per event.
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };

    // Sync immediately in case the page was restored at a scrolled offset.
    update();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const scrolled = scrollY >= SCROLL_THRESHOLD;

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/70 backdrop-blur-md border-b border-white/30 shadow-sm py-2"
          : "bg-white/70 backdrop-blur-md border-b border-white/30 shadow-sm py-4"
      }`}
    >
      <div className="max-w-5xl mx-auto px-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.svg" alt="Colly" width={30} height={30} priority />
          <span className="font-display text-lg tracking-tight text-gray-900">
            Colly
          </span>
        </Link>
        <nav className="flex items-center gap-5">
          <Link
            href="/find-an-agent"
            className="hidden text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 sm:block"
          >
            Find an Agent
          </Link>
          <NavbarAuthActions />
        </nav>
      </div>
    </header>
  );
}
