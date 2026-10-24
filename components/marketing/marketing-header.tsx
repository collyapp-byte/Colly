"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
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
  const [menuOpen, setMenuOpen] = useState(false);

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
            className="hidden text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 md:block"
          >
            Find an Agent
          </Link>
          <Link
            href="/signup?role=agent"
            className="hidden text-sm font-medium text-gray-600 transition-colors hover:text-[#FF6600] md:block"
          >
            Agent Program
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-marketing-menu"
            className="rounded-md p-2 text-gray-600 transition-colors hover:bg-gray-100 md:hidden"
          >
            {menuOpen ? (
              <X className="h-5 w-5" aria-hidden />
            ) : (
              <Menu className="h-5 w-5" aria-hidden />
            )}
          </button>
          <NavbarAuthActions />
        </nav>
      </div>

      {menuOpen && (
        <div
          id="mobile-marketing-menu"
          className="absolute top-full left-0 w-full bg-white shadow-lg border-b border-gray-100 p-4 flex flex-col gap-4 z-50 md:hidden"
        >
          <Link
            href="/signup?role=agent"
            onClick={() => setMenuOpen(false)}
            className="text-sm font-medium text-gray-600 transition-colors hover:text-[#FF6600]"
          >
            Agent Program
          </Link>
          <Link
            href="/login"
            onClick={() => setMenuOpen(false)}
            className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
          >
            Sign In
          </Link>
        </div>
      )}
    </header>
  );
}
