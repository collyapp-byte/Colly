"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { PanelLeft } from "lucide-react";
import { AgentSidebar } from "./agent-sidebar";

const TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  training: "Training",
  certificate: "Certificate",
  referrals: "Referrals",
};

type AgentShellProps = {
  agentBadge?: ReactNode;
  children: ReactNode;
};

/**
 * Chrome for the signed-in agent area: fixed sidebar on desktop, a drawer on
 * mobile, and a top bar showing the agent's ID and certification status.
 */
export function AgentShell({ agentBadge, children }: AgentShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = usePathname();
  const segment = pathname.split("/")[2] ?? "dashboard";
  const title = TITLES[segment] ?? "Dashboard";

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
            <AgentSidebar onClose={() => setMobileNavOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-h-screen md:h-screen md:overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 flex-col md:flex">
          <AgentSidebar />
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
              {agentBadge}
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
