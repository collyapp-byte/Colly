"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  CreditCard,
  FileText,
  HelpCircle,
  LayoutGrid,
  LogOut,
  MapPin,
  MessageSquare,
  Package,
  QrCode,
  Settings,
  ShoppingCart,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { logout } from "@/lib/auth-actions";
import { isOwnerOnlyPath } from "@/lib/team";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const SECTIONS: NavSection[] = [
  {
    title: "Home",
    items: [
      { label: "Overview", href: "/dashboard", icon: LayoutGrid },
      { label: "Colly AI", href: "/ai", icon: Sparkles },
    ],
  },
  {
    title: "Inbox",
    items: [
      { label: "Conversations", href: "/conversations", icon: MessageSquare },
    ],
  },
  {
    title: "Sell",
    items: [
      { label: "Customers", href: "/customers", icon: Users },
      { label: "Sales", href: "/sales", icon: ShoppingCart },
      { label: "Invoices", href: "/invoices", icon: FileText },
      { label: "Bookings", href: "/bookings", icon: Calendar },
    ],
  },
  {
    title: "Catalogue",
    items: [
      { label: "Products", href: "/products", icon: Package },
      { label: "FAQs", href: "/faqs", icon: HelpCircle },
    ],
  },
  {
    title: "Manage",
    items: [
      { label: "Settings", href: "/settings", icon: Settings },
      { label: "QR Code", href: "/settings/qr-code", icon: QrCode },
      { label: "Find an Agent", href: "/find-an-agent", icon: MapPin },
      { label: "Team", href: "/settings/team", icon: Users },
    ],
  },
];

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/settings") {
    return pathname === "/settings";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

type SidebarProps = {
  onClose?: () => void;
  hasNoProducts?: boolean;
  hasNoFaqs?: boolean;
  hasPendingEscalations?: boolean;
  hasNoChannels?: boolean;
  isOwner?: boolean;
};

export function Sidebar({
  onClose,
  hasNoProducts = false,
  hasNoFaqs = false,
  hasPendingEscalations = false,
  hasNoChannels = false,
  isOwner = true,
}: SidebarProps) {
  const pathname = usePathname();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const switcherRef = useRef<HTMLDivElement>(null);

  function shouldShowDot(href: string): boolean {
    return (
      (href === "/products" && hasNoProducts) ||
      (href === "/faqs" && hasNoFaqs) ||
      (href === "/ai" && hasNoChannels) ||
      (href === "/conversations" && hasPendingEscalations)
    );
  }

  useEffect(() => {
    let active = true;
    fetch("/api/business")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { ownerEmail?: string; ownerName?: string } | null) => {
          if (!active || !data) return;
          if (data.ownerEmail) setOwnerEmail(data.ownerEmail);
          if (data.ownerName) {
            setOwnerName(data.ownerName);
          } else if (data.ownerEmail) {
            const prefix = data.ownerEmail.split("@")[0] || data.ownerEmail;
            setOwnerName(prefix.charAt(0).toUpperCase() + prefix.slice(1));
          }
        })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!switcherOpen) return;
    function handleMouseDown(event: MouseEvent) {
      if (switcherRef.current && !switcherRef.current.contains(event.target as Node)) {
        setSwitcherOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSwitcherOpen(false);
    }
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [switcherOpen]);

  return (
    <div className="flex h-full w-[240px] flex-col bg-white/60 backdrop-blur-md border-r border-white/40 shadow-sm">
      <div ref={switcherRef} className="relative flex h-14 shrink-0 items-center gap-2 border-b border-gray-100 px-4">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={switcherOpen}
          onClick={() => setSwitcherOpen((open) => !open)}
          className="mx-2 flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-gray-50"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden">
            <Image src="/logo.svg" alt="" aria-hidden="true" width={28} height={28} />
          </div>
          <div className="flex flex-1 flex-col text-left">
            <span className="text-sm font-semibold text-gray-900">Colly</span>
          </div>
          <ChevronDown
            className={`h-3.5 w-3.5 text-gray-400 transition-transform duration-150 ${switcherOpen ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>

        {switcherOpen && (
          <div role="menu" className="absolute left-2 right-2 top-[calc(100%+4px)] z-50 rounded-xl border border-white/50 bg-white/80 py-1.5 shadow-lg backdrop-blur-lg">
            <div className="mx-1.5 mb-1 border-b border-gray-100 px-3 pb-2">
              <p className="text-[11px] text-gray-400">Signed in as</p>
              <p className="truncate text-[13px] text-gray-700">{ownerEmail || "..."}</p>
            </div>
            <Link href="/settings" role="menuitem" onClick={() => setSwitcherOpen(false)} className="mx-1.5 flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-[13px] text-gray-700 transition-colors hover:bg-gray-50">
              <Settings className="h-3.5 w-3.5" aria-hidden />
              Account settings
            </Link>
            {isOwner && (
              <Link href="/settings/billing" role="menuitem" onClick={() => setSwitcherOpen(false)} className="mx-1.5 flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-[13px] text-gray-700 transition-colors hover:bg-gray-50">
                <CreditCard className="h-3.5 w-3.5" aria-hidden />
                Billing &amp; plan
              </Link>
            )}
            <form action={logout} className="mx-1.5">
              <button type="submit" role="menuitem" className="flex min-h-[44px] w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-[13px] text-gray-700 transition-colors hover:bg-gray-50 hover:text-red-600">
                <LogOut className="h-3.5 w-3.5" aria-hidden />
                Sign out
              </button>
            </form>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-4">
        <nav aria-label="Main navigation" className="flex flex-col gap-5">
          {SECTIONS.map((section) => {
            const visibleItems = section.items.filter((item) => isOwner || !isOwnerOnlyPath(item.href));
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.title}>
                <div className="px-3 pb-2">
                  <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
                    {section.title}
                  </span>
                </div>
                <ul className="flex flex-col gap-0.5">
                  {visibleItems.map((item) => {
                    const active = isActivePath(pathname, item.href);
                    const Icon = item.icon;
                    return (
                      <li key={item.label}>
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          onClick={onClose}
                          className={`relative flex h-8 items-center gap-3 rounded-lg px-3 text-[13.5px] font-medium transition-colors ${
                            active ? "bg-[#FFF4EC] text-[#FF6600] nav-active-texture" : "text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          <Icon className={`h-4 w-4 stroke-[1.5] ${active ? "text-[#FF6600]" : "text-gray-500"}`} aria-hidden />
                          <span>{item.label}</span>
                          {shouldShowDot(item.href) && (
                            <span className="ml-auto h-2 w-2 rounded-full bg-[#FF6600]" />
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-gray-100 px-4 pt-3 pb-3 shrink-0">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={switcherOpen}
          onClick={() => setSwitcherOpen((open) => !open)}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-gray-50"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FF6600] text-sm font-semibold text-white">
            {ownerName ? ownerName.charAt(0).toUpperCase() : ""}
          </div>
          <div className="flex flex-1 flex-col text-left">
            <span className="text-[13px] font-medium text-gray-900">{ownerName || "..."}</span>
            <span className="text-[11px] text-gray-500">Owner</span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-gray-400" aria-hidden />
        </button>
      </div>
    </div>
  );
}