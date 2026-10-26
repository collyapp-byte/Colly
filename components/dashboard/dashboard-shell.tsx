"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, Bell, Settings, PanelLeft } from "lucide-react";
import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";
import { usePathname } from "next/navigation";
import { PlanChip } from "./plan-chip";

type DashboardShellProps = {
  businessName?: string;
  hasNoProducts?: boolean;
  hasNoFaqs?: boolean;
  hasPendingEscalations?: boolean;
  pendingEscalations?: number;
  telegramConnected?: boolean;
  ownerAlertsLinked?: boolean;
  hasNoChannels?: boolean;
  children: ReactNode;
};

export function DashboardShell({
  businessName,
  hasNoProducts = false,
  hasNoFaqs = false,
  hasPendingEscalations = false,
  pendingEscalations = 0,
  telegramConnected = true,
  ownerAlertsLinked = true,
  hasNoChannels = false,
  children,
}: DashboardShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const pathname = usePathname();
  const segment = pathname === "/" ? "Dashboard" : (pathname.split("/")[1] || "Dashboard");
  const title = segment.charAt(0).toUpperCase() + segment.slice(1);
  const label = businessName?.trim() || title;

  // Two-Number Model: surface a "Setup Pending" chip until the dedicated AI
  // line is connected, so a freshly signed-up owner knows the next step.
  useEffect(() => {
    let active = true;

    fetch("/api/business")
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (
          data: {
            business?: {
              telegramConnected?: boolean;
              discordConnected?: boolean;
              whatsappConnected?: boolean;
            };
          } | null,
        ) => {
          if (active && data?.business) {
            const business = data.business;
            setIsConnected(
              business.telegramConnected === true ||
                business.discordConnected === true ||
                business.whatsappConnected === true,
            );
          }
        },
      )
      .catch(() => {
        // Without a status, show the plain business name only.
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#f8fafc] bg-radial-[ellipse_at_top] from-orange-100/40 via-gray-50 to-blue-100/20">
      {/* Mobile drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMobileNavOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-black/40"
          />
          <div className="absolute inset-y-0 left-0 w-[260px] bg-transparent">
            <Sidebar
              onClose={() => setMobileNavOpen(false)}
              hasNoProducts={hasNoProducts}
              hasNoFaqs={hasNoFaqs}
              hasPendingEscalations={hasPendingEscalations}
              hasNoChannels={hasNoChannels}
            />
          </div>
        </div>
      )}

      <div className="flex min-h-screen w-full max-w-full overflow-x-hidden md:h-screen md:overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 flex-col md:flex">
          <Sidebar
            hasNoProducts={hasNoProducts}
            hasNoFaqs={hasNoFaqs}
            hasPendingEscalations={hasPendingEscalations}
            hasNoChannels={hasNoChannels}
          />
        </aside>

        {/* Right column */}
        <div className="flex w-full min-w-0 flex-1 flex-col overflow-x-hidden px-0 md:px-4 md:pt-4 md:pb-4 md:min-h-0">
          {(!telegramConnected || !ownerAlertsLinked) && (
            <div
              role="alert"
              className="mx-3 mt-3 flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between md:mx-0"
            >
              <span className="flex items-start gap-2">
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
                  aria-hidden
                />
                <span>
                  ⚠️ ACTION REQUIRED: Connect your Telegram bot and verify
                  Owner Alerts to avoid missing sales.
                </span>
              </span>
              <Link
                href="/settings/ai-line"
                className="shrink-0 rounded-md bg-amber-600 px-3 py-1.5 text-center text-xs font-semibold text-white transition-colors hover:bg-amber-700"
              >
                Complete setup
              </Link>
            </div>
          )}
          {/* Top bar - glass, floats over the tinted page background. It scrolls
              horizontally on narrow screens so the bar never widens the page. */}
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 overflow-x-auto bg-white/40 backdrop-blur-md no-scrollbar">
            <div className="flex shrink-0 items-center gap-3 px-3 md:px-0">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open menu"
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 md:hidden"
              >
                <PanelLeft className="h-[18px] w-[18px]" />
              </button>
              <span className="max-w-[40vw] truncate text-[13px] font-medium whitespace-nowrap text-gray-500 md:max-w-none">
                {label}
              </span>
              {isConnected === false && (
                <span className="hidden rounded-full bg-[#FFF4EC] px-2 py-0.5 text-[11px] font-semibold tracking-wide whitespace-nowrap text-[#FF6600] sm:inline-block">
                  Setup Pending
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3 px-3 md:px-0">
              <PlanChip />
              <Link
                href="/notifications"
                aria-label="Notifications"
                className="relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100"
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
                className="hidden min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 md:flex"
              >
                <Settings className="h-[18px] w-[18px]" />
              </Link>
            </div>
          </header>

          {/* Content card - frosted glass, rounded, below the top bar */}
          <main className="flex-1 rounded-none bg-white/60 backdrop-blur-md shadow-none md:mt-3 md:rounded-(--card-radius) md:shadow-(--card-shadow) md:overflow-auto md:min-h-0">
            <div className="w-full p-4 pb-20 md:p-6 md:pb-8">{children}</div>
          </main>
        </div>
      </div>
      <MobileNav />
    </div>
  );
}
