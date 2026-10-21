"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Settings, PanelLeft } from "lucide-react";
import { Sidebar } from "./sidebar";
import { usePathname } from "next/navigation";
import { PlanChip } from "./plan-chip";

type DashboardShellProps = {
  businessName?: string;
  children: ReactNode;
};

export function DashboardShell({ businessName, children }: DashboardShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [aiLineConnected, setAiLineConnected] = useState<boolean | null>(null);
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
      .then((data: { business?: { aiLineConnected?: boolean } } | null) => {
        if (active && data?.business) {
          setAiLineConnected(data.business.aiLineConnected === true);
        }
      })
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
            <Sidebar onClose={() => setMobileNavOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-h-screen w-full max-w-full overflow-x-hidden md:h-screen md:overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 flex-col md:flex">
          <Sidebar />
        </aside>

        {/* Right column */}
        <div className="flex w-full min-w-0 flex-1 flex-col overflow-x-hidden px-0 md:px-4 md:pt-4 md:pb-4 md:min-h-0">
          {/* Top bar - glass, floats over the tinted page background. It scrolls
              horizontally on narrow screens so the bar never widens the page. */}
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 overflow-x-auto bg-white/40 backdrop-blur-md no-scrollbar">
            <div className="flex shrink-0 items-center gap-3 px-3 md:px-0">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open menu"
                className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 md:hidden"
              >
                <PanelLeft className="h-[18px] w-[18px]" />
              </button>
              <span className="max-w-[40vw] truncate text-[13px] font-medium whitespace-nowrap text-gray-500 md:max-w-none">
                {label}
              </span>
              {aiLineConnected === false && (
                <span className="hidden rounded-full bg-[#FFF4EC] px-2 py-0.5 text-[11px] font-semibold tracking-wide whitespace-nowrap text-[#FF6600] sm:inline-block">
                  Setup Pending
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3 px-3 md:px-0">
              <PlanChip />
              <Link
                href="/settings"
                aria-label="Settings"
                className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100"
              >
                <Settings className="h-[18px] w-[18px]" />
              </Link>
            </div>
          </header>

          {/* Content card - frosted glass, rounded, below the top bar */}
          <main className="flex-1 rounded-none bg-white/60 backdrop-blur-md shadow-none md:mt-3 md:rounded-(--card-radius) md:shadow-(--card-shadow) md:overflow-auto md:min-h-0">
            <div className="w-full p-4 md:p-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
