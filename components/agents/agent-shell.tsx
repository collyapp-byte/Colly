"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
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
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const segment = pathname.split("/")[2] ?? "dashboard";
  const title = TITLES[segment] ?? "Dashboard";

  // While the drawer is open it is a modal surface: Escape closes it, the page
  // behind stops scrolling, focus moves inside, Tab cycles within it and focus
  // returns to the trigger on close. Mirrors the dashboard shell so both areas
  // behave the same on a phone.
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
      );
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

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            tabIndex={-1}
            onClick={() => setMobileNavOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-black/40"
          />
          <div
            id="agent-mobile-nav"
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Agent menu"
            tabIndex={-1}
            className="absolute inset-y-0 left-0 w-[260px] max-w-[85vw] overflow-hidden rounded-r-2xl border-r border-card-border bg-card-surface shadow-card-hover transition-all duration-250 focus:outline-none"
          >
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
          {/* Top bar - on the page background, no card */}
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between bg-background">
            <div className="flex items-center gap-3 px-3 md:px-0">
              <button
                ref={menuButtonRef}
                type="button"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open menu"
                aria-haspopup="dialog"
                aria-expanded={mobileNavOpen}
                aria-controls="agent-mobile-nav"
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-muted transition-all duration-250 ease-out hover:bg-surface-muted hover:text-main active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-colly/40 md:hidden"
              >
                <PanelLeft className="h-[18px] w-[18px]" />
              </button>
              <span className="text-[13px] font-medium text-muted">{title}</span>
            </div>
            <div className="flex items-center gap-3 px-3 md:px-0">
              {agentBadge}
            </div>
          </header>

          {/* Content card - themed surface, rounded, below the top bar */}
          <main className="flex-1 rounded-none border-0 bg-card-surface shadow-none md:mt-3 md:rounded-(--card-radius) md:border md:border-card-border md:shadow-card md:min-h-0 md:overflow-auto">
            <div className="w-full p-4 md:p-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
