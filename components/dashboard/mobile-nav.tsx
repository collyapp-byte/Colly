"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  MessageSquare,
  Settings,
  ShoppingCart,
  Package,
  type LucideIcon,
} from "lucide-react";
import { isActiveNavPath } from "@/lib/nav";

type MobileTab = {
  label: string;
  href: string;
  icon: LucideIcon;
};

const TABS: MobileTab[] = [
  { label: "Home", href: "/dashboard", icon: Home },
  { label: "Inbox", href: "/conversations", icon: MessageSquare },
  { label: "Sell", href: "/sales", icon: ShoppingCart },
  { label: "Catalogue", href: "/products", icon: Package },
  { label: "Settings", href: "/settings", icon: Settings },
];

/* One timing for the whole bar: the same 250ms clock the desktop rail and the
   cards use, so a tap reads as a press rather than a jump. */
const TAB_CLASS =
  "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium transition-all duration-250 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-colly/40";
const ICON_WRAPPER_CLASS =
  "flex h-7 w-12 items-center justify-center rounded-full transition-all duration-250";

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-card-border bg-card-surface/95 pb-safe shadow-[0_-8px_24px_-16px_rgba(16,24,40,0.35)] backdrop-blur-xl md:hidden"
    >
      {TABS.map((tab) => {
        const active = isActiveNavPath(pathname, tab.href);
        const Icon = tab.icon;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`${TAB_CLASS} ${
              active ? "text-colly" : "text-muted hover:text-main"
            }`}
          >
            {/* The tinted pill is the touch affordance; the card-border ring
                keeps it visible on the dark surface where a solid cream chip
                would glow (see --nav-tint). */}
            <span
              className={`${ICON_WRAPPER_CLASS} ${
                active
                  ? "nav-active-texture bg-colly-tint ring-1 ring-colly/20 ring-inset"
                  : ""
              }`}
            >
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}