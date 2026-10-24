"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  MessageSquare,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

type MobileTab = {
  label: string;
  href: string;
  icon: LucideIcon;
};

const TABS: MobileTab[] = [
  { label: "Overview", href: "/dashboard", icon: Home },
  { label: "Chats", href: "/conversations", icon: MessageSquare },
  { label: "AI Hub", href: "/ai", icon: Sparkles },
  { label: "Settings", href: "/settings", icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 flex items-center justify-around pb-safe md:hidden"
    >
      {TABS.map((tab) => {
        const active = isActive(pathname, tab.href);
        const Icon = tab.icon;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
              active ? "text-[#FF6600]" : "text-gray-500"
            }`}
          >
            <Icon className="h-5 w-5" aria-hidden />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
