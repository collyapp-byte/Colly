"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Award,
  BookOpen,
  ChevronDown,
  LayoutGrid,
  LogOut,
  Settings,
  Share2,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { agentLogout } from "@/lib/agent-auth-actions";
import { isActiveNavPath } from "@/lib/nav";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/agents/dashboard", icon: LayoutGrid },
  { label: "Training", href: "/agents/training", icon: BookOpen },
  { label: "Certificate", href: "/agents/certificate", icon: Award },
  { label: "Referrals", href: "/agents/referrals", icon: Share2 },
  { label: "Wallet", href: "/agents/wallet", icon: Wallet },
];

/* Shared with the dashboard rail and the mobile tab bar, so "where am I" is
   answered by one rule. */
const MENU_ITEM_CLASS =
  "flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-main transition-all duration-250 ease-out hover:bg-surface-muted active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-colly/40";

export function AgentSidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [agentInfo, setAgentInfo] = useState<{
    fullName: string;
    agentNumber: string;
  } | null>(null);
  const switcherRef = useRef<HTMLDivElement>(null);

  // The agent's name and number for the switcher header. Fetched once; the
  // menu still works (navigation + sign out) while it loads.
  useEffect(() => {
    let active = true;

    fetch("/api/agents/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { agent?: { fullName: string; agentNumber: string } } | null) => {
        if (active && data?.agent) {
          setAgentInfo({
            fullName: data.agent.fullName,
            agentNumber: data.agent.agentNumber,
          });
        }
      })
      .catch(() => {
        // The name/number are decorative; leave the placeholder on failure.
      });

    return () => {
      active = false;
    };
  }, []);

  // Close the switcher on click outside or Escape.
  useEffect(() => {
    if (!switcherOpen) return;

    function handleMouseDown(event: MouseEvent) {
      if (
        switcherRef.current &&
        !switcherRef.current.contains(event.target as Node)
      ) {
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
    <div className="flex h-full w-[240px] flex-col border-r border-card-border bg-card-surface">
      {/* Agent switcher */}
      <div
        ref={switcherRef}
        className="relative flex h-14 items-center gap-2 border-b border-card-border px-4"
      >
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={switcherOpen}
          onClick={() => setSwitcherOpen((open) => !open)}
          className="mx-2 flex w-full cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-all duration-250 ease-out hover:bg-surface-muted active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-colly/40"
        >
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg">
            {/* Decorative: the switcher button already reads "Colly Agent
                Programme" from the text beside it, so the mark must not repeat
                the name. */}
            <Image src="/logo.svg" alt="" aria-hidden="true" width={28} height={28} />
          </div>
          <div className="flex flex-1 flex-col text-left">
            <span className="text-sm font-semibold text-main">Colly</span>
            <span className="text-[11px] text-muted">Agent Programme</span>
          </div>
          <ChevronDown
            className={`h-3.5 w-3.5 text-muted transition-transform duration-250 ${
              switcherOpen ? "rotate-180" : ""
            }`}
            aria-hidden
          />
        </button>

        {switcherOpen && (
          <div
            role="menu"
            className="absolute left-2 right-2 top-[calc(100%+4px)] z-50 rounded-xl border border-card-border bg-card-surface py-1.5 shadow-card-hover"
          >
            {/* Header */}
            <div className="mx-1.5 mb-1 border-b border-card-border px-3 pb-2">
              <p className="text-[11px] text-muted">Signed in as</p>
              <p className="truncate text-[13px] text-main">
                {agentInfo?.fullName || "..."}
              </p>
              <p className="text-[11px] text-muted">
                {agentInfo?.agentNumber || ""}
              </p>
            </div>

            <Link
              href="/agents/dashboard"
              role="menuitem"
              onClick={() => setSwitcherOpen(false)}
              className={`mx-1.5 ${MENU_ITEM_CLASS}`}
            >
              <Settings className="h-3.5 w-3.5" aria-hidden />
              Account settings
            </Link>

            <Link
              href="/agents/certificate"
              role="menuitem"
              onClick={() => setSwitcherOpen(false)}
              className={`mx-1.5 ${MENU_ITEM_CLASS}`}
            >
              <Award className="h-3.5 w-3.5" aria-hidden />
              Certificate
            </Link>

            <form action={agentLogout} className="mx-1.5">
              <button
                type="submit"
                role="menuitem"
                className={`w-full hover:text-red-600 ${MENU_ITEM_CLASS}`}
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden />
                Sign out
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Nav */}
      <div className="px-2 pt-4">
        <nav aria-label="Agent navigation">
          <ul className="flex flex-col gap-0.5">
            {NAV_ITEMS.map((item) => {
              const active = isActiveNavPath(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={onClose}
                    className={`flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-[13.5px] font-medium transition-all duration-250 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-colly/40 md:h-9 md:min-h-0 ${
                      active
                        ? "nav-active-texture bg-colly-tint text-colly ring-1 ring-colly/15 ring-inset"
                        : "text-main hover:bg-surface-muted"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 stroke-[1.5] ${
                        active ? "text-colly" : "text-muted"
                      }`}
                      aria-hidden
                    />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      <div className="flex-1" />

      {/* Sign out */}
      <div className="border-t border-card-border px-2 py-2">
        <form action={agentLogout}>
          <button
            type="submit"
            className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-[13.5px] font-medium text-main transition-all duration-250 ease-out hover:bg-surface-muted hover:text-red-600 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-colly/40 md:h-9 md:min-h-0"
          >
            <LogOut className="h-4 w-4 stroke-[1.5] text-muted" aria-hidden />
            <span>Sign out</span>
          </button>
        </form>
      </div>
    </div>
  );
}
