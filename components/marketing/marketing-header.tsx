"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { NavbarAuthActions } from "@/components/marketing/navbar-auth-actions";

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
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };
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
          ? "bg-white/80 backdrop-blur-md border-b border-gray-200/50 shadow-sm py-2"
          : "bg-transparent py-4"
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.svg" alt="" aria-hidden="true" width={28} height={28} priority />
          <span className="font-display text-lg tracking-tight text-gray-900 font-semibold">
            Colly
          </span>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-6">
          {/* Desktop Links */}
          <div className="hidden md:flex items-center gap-6 mr-4">
            <Link href="/pricing" className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900">Pricing</Link>
            <Link href="/find-an-agent" className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900">Find an Agent</Link>
            <Link href="/academy" className="text-sm font-medium text-gray-600 transition-colors hover:text-[#FF6600]">Agent Program</Link>
          </div>

          <NavbarAuthActions />

          {/* Mobile Hamburger - Far Right */}
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="rounded-md p-2 text-gray-600 transition-colors hover:bg-gray-100 md:hidden"
          >
            {menuOpen ? <X className="h-6 w-6" aria-hidden /> : <Menu className="h-6 w-6" aria-hidden />}
          </button>
        </nav>
      </div>

      {menuOpen && (
        <div className="absolute top-full left-0 w-full bg-white shadow-lg border-b border-gray-100 p-6 flex flex-col gap-5 z-50 md:hidden">
          <Link href="/pricing" onClick={() => setMenuOpen(false)} className="text-base font-semibold text-gray-900">Pricing</Link>
          
          <Link href="/academy" onClick={() => setMenuOpen(false)} className="text-base font-semibold text-[#FF6600]">Agent Program</Link>
          <hr className="border-gray-100" />
          <Link href="/login" onClick={() => setMenuOpen(false)} className="text-base font-medium text-gray-600">Sign In</Link>
          <Link
            href="/signup"
            onClick={() => setMenuOpen(false)}
            className="text-base font-medium text-gray-600 transition-colors hover:text-gray-900"
          >
            Get Started
          </Link>
        </div>
      )}
    </header>
  );
}