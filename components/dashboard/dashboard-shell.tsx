"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Settings, PanelLeft } from "lucide-react";
import { Sidebar } from "./sidebar";
import { usePathname } from "next/navigation";
import { PlanChip } from "./plan-chip";

type DashboardShellProps = {
  businessName?: string;
  children: ReactNode;
};

export function DashboardShell({ children }: DashboardShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = usePathname();
  const segment = pathname === "/" ? "Dashboard" : (pathname.split("/")[1] || "Dashboard");
  const title = segment.charAt(0).toUpperCase() + segment.slice(1);

  return (
    <div className="min-h-screen bg-(--background-page)">
      {/* Mobile drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMobileNavOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-black/40"
          />
          <div className="absolute inset-y-0 left-0 w-[260px] bg-(--card-surface)">
            <Sidebar onClose={() => setMobileNavOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-h-screen md:h-screen md:overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 flex-col md:flex">
          <Sidebar />
        </aside>

        {/* Right column */}
        <div className="flex min-w-0 flex-1 flex-col px-0 md:px-4 md:pt-4 md:pb-4 md:min-h-0">
          {/* Top bar - on cream, no card */}
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between bg-(--background-page)">
            <div className="flex items-center gap-3 px-3 md:px-0">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open menu"
                className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 md:hidden"
              >
                <PanelLeft className="h-[18px] w-[18px]" />
              </button>
              <span className="text-[13px] font-medium text-gray-500">{title}</span>
            </div>
            <div className="flex items-center gap-3 px-3 md:px-0">
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

          {/* Content card - white, rounded, below the top bar */}
          <main className="flex-1 rounded-none bg-(--card-surface) shadow-none md:mt-3 md:rounded-(--card-radius) md:shadow-(--card-shadow) md:overflow-auto md:min-h-0">
            <div className="w-full p-4 md:p-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
