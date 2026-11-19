"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, Bell, Settings, PanelLeft } from "lucide-react";
import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";
import { usePathname } from "next/navigation";
import { PlanChip } from "./plan-chip";
import { InstallPrompt } from "@/components/pwa/install-prompt";

type DashboardShellProps = {
  businessName?: string;
  /** The signed-in account, rendered by the sidebar's footer menu. */
  ownerName?: string;
  ownerEmail?: string;
  hasNoProducts?: boolean;
  hasNoFaqs?: boolean;
  hasUnreadEscalations?: boolean;
  /**
   * Unread escalations (raised since the owner last opened Notifications) ”
   * the bell badge. `hasUnreadEscalations` is the wider "anything still
   * waiting" flag the sidebar dot uses.
   */
  pendingEscalations?: number;
  telegramConnected?: boolean;
  ownerAlertsLinked?: boolean;
  hasNoChannels?: boolean;
  /**
   * False for an invited staff account: owner-only settings links (and the
   * "complete setup" banner that points at one) are hidden instead of shown as
   * dead ends. The server is still the gate ” see `lib/team.ts`.
   */
  isOwner?: boolean;
  children: ReactNode;
};

export function DashboardShell({
  businessName,
  ownerName,
  ownerEmail,
  hasNoProducts = false,
  hasNoFaqs = false,
  hasUnreadEscalations = false,
  pendingEscalations = 0,
  telegramConnected = true,
  ownerAlertsLinked = true,
  hasNoChannels = false,
  isOwner = true,
  children,
}: DashboardShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const segment = pathname === "/" ? "Dashboard" : (pathname.split("/")[1] || "Dashboard");
  const title = segment.charAt(0).toUpperCase() + segment.slice(1);
  const label = businessName?.trim() || title;

  // While the drawer is open it is a modal surface: Escape closes it, the page
  // behind stops scrolling, focus moves inside, Tab cycles within it and focus
  // returns to the trigger on close. Folded sidebar groups are `inert`, so
  // their links are skipped by the trap.
  useEffect(() => {
    if (!mobileNavOpen) return;

    const previousOverflow = document.body.style.overflow;
    const trigger = menuButtonRef.current;
    document.body.style.overflow = "hidden";
    drawerRef.current?.focus();

    function focusableElements(): HTMLElement[] {
      if (!drawerRef.current) return [];
      return Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled])",
        ),
      ).filter((element) => !element.closest("[inert]"));
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileNavOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      const elements = focusableElements();
      if (elements.length === 0) return;

      const first = elements[0];
      const last = elements[elements.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (!active || !elements.includes(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [mobileNavOpen]);

  /*
   * `overflow-x-clip`, never `overflow-x-hidden`: `hidden` turns these boxes
   * into scroll containers (its `overflow-y` is forced to `auto`), so the page
   * scrolls inside the shell and a two-finger pinch reads as the container
   * growing. `clip` keeps the horizontal bounds without claiming the scroll
   * gesture, so pinch-to-zoom stays optical.
   */
  return (
    <div
      data-dashboard-shell
      className="min-h-screen w-full max-w-full overflow-x-clip bg-background bg-radial-[ellipse_at_top] from-orange-100/40 via-gray-50 to-blue-100/20 dark:from-orange-500/10 dark:via-background dark:to-blue-500/10"
    >
      {/* Mobile drawer */}
      {mobileNavOpen && (
        <div data-print-hide className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            tabIndex={-1}
            onClick={() => setMobileNavOpen(false)}
            className="animate-in absolute inset-0 h-full w-full cursor-default bg-black/40"
          />
          <div
            id="dashboard-mobile-nav"
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Main menu"
            tabIndex={-1}
            className="animate-in absolute inset-y-0 left-0 w-[280px] max-w-[85vw] overflow-hidden rounded-r-2xl border-r border-card-ring bg-card-surface shadow-card-hover focus:outline-none"
          >
            <Sidebar
              ownerName={ownerName}
              ownerEmail={ownerEmail}
              onClose={() => setMobileNavOpen(false)}
              hasNoProducts={hasNoProducts}
              hasNoFaqs={hasNoFaqs}
              hasUnreadEscalations={hasUnreadEscalations}
              hasNoChannels={hasNoChannels}
              isOwner={isOwner}
            />
          </div>
        </div>
      )}

      <div className="flex min-h-screen w-full max-w-full overflow-x-clip md:h-screen md:overflow-hidden">
        {/* Desktop sidebar */}
        <aside
          data-print-hide
          className="hidden w-64 shrink-0 flex-col md:flex"
        >
          <Sidebar
            ownerName={ownerName}
            ownerEmail={ownerEmail}
            hasNoProducts={hasNoProducts}
            hasNoFaqs={hasNoFaqs}
            hasUnreadEscalations={hasUnreadEscalations}
            hasNoChannels={hasNoChannels}
            isOwner={isOwner}
          />
        </aside>

        {/* Right column */}
        <div className="flex w-full min-w-0 flex-1 flex-col overflow-x-clip px-0 md:px-4 md:pt-4 md:pb-4 md:min-h-0">
          {isOwner && (!telegramConnected || !ownerAlertsLinked) && (
            <div
              role="alert"
              data-print-hide
              className="mx-3 mt-3 flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between md:mx-0 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
            >
              <span className="flex items-start gap-2">
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
                  aria-hidden
                />
                <span>
                  š ï¸ ACTION REQUIRED: Connect your Telegram bot and verify
                  Owner Alerts to avoid missing sales.
                </span>
              </span>
              <Link
                href="/channels"
                className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-center text-xs font-semibold text-white shadow-sm transition-all duration-250 hover:-translate-y-px hover:bg-amber-700 hover:shadow-md active:translate-y-0 active:scale-[0.98]"
              >
                Complete setup
              </Link>
            </div>
          )}
          {/* Top bar - glass, floats over the tinted page background. It scrolls
              horizontally on narrow screens so the bar never widens the page. */}
          <header
            data-print-hide
            className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 overflow-x-auto border-b border-card-ring/70 bg-card-surface/60 backdrop-blur-xl no-scrollbar"
          >
            <div className="flex shrink-0 items-center gap-3 px-3 md:px-0">
              <button
                ref={menuButtonRef}
                type="button"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open menu"
                aria-haspopup="dialog"
                aria-expanded={mobileNavOpen}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-muted transition-all duration-250 hover:bg-surface-muted hover:text-main active:scale-[0.94] md:hidden"
              >
                <PanelLeft className="h-[18px] w-[18px]" />
              </button>
              <span className="max-w-[40vw] truncate text-[13px] font-medium whitespace-nowrap text-muted md:max-w-none">
                {label}
              </span>
              {hasNoChannels && (
                <span className="hidden rounded-full bg-colly-tint px-2 py-0.5 text-[11px] font-semibold tracking-wide whitespace-nowrap text-colly sm:inline-block">
                  Setup Pending
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3 px-3 md:px-0">
              {/* Renders only while the browser is offering an install (and
                  registers the service worker that makes it installable). */}
              <InstallPrompt />
              <PlanChip />
              <Link
                href="/notifications"
                aria-label="Notifications"
                className="relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-muted transition-all duration-250 hover:bg-surface-muted hover:text-main active:scale-[0.94]"
              >
                <Bell className="h-[18px] w-[18px]" />
                {pendingEscalations > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                    {pendingEscalations > 9 ? "9+" : pendingEscalations}
                  </span>
                )}
              </Link>
              <Link
                href="/settings"
                aria-label="Settings"
                className="hidden min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-muted transition-all duration-250 hover:bg-surface-muted hover:text-main active:scale-[0.94] md:flex"
              >
                <Settings className="h-[18px] w-[18px]" />
              </Link>
            </div>
          </header>

          {/* Content card - frosted glass, rounded, below the top bar */}
          <main className="flex-1 rounded-none border-t border-card-ring/60 bg-card-surface/75 shadow-none backdrop-blur-xl md:mt-3 md:min-h-0 md:overflow-auto md:rounded-(--card-radius) md:border md:border-card-ring md:shadow-card">
            <div className="mx-auto w-full p-4 pb-24 md:p-6 md:pb-8 lg:p-7 lg:pb-10">
              {children}
            </div>
          </main>
        </div>
      </div>
      {/* The mobile tab bar is screen navigation only; keep it off paper. */}
      <div data-print-hide>
        <MobileNav />
      </div>
    </div>
  );
}

