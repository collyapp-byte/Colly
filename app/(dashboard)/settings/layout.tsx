"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Business", href: "/settings" },
  { label: "AI & Channels", href: "/settings/ai-line" },
  { label: "Billing", href: "/settings/billing" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="font-display text-2xl text-main">Settings</h1>
      <p className="mt-1 text-sm text-muted">
        Manage your business profile and how your AI assistant talks to customers.
      </p>

      {/* Tab Navigation */}
      <div className="mt-6 flex gap-2 overflow-x-auto rounded-xl border border-card-ring bg-surface-muted/60 p-1 no-scrollbar">
        {TABS.map((tab) => {
          // Make "Business" active for /settings, /settings/team, and /settings/qr-code
          const isActive = 
            tab.href === "/settings" 
              ? pathname === "/settings" || pathname.startsWith("/settings/team") || pathname.startsWith("/settings/qr-code")
              : pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition-all duration-250 ease-out active:scale-[0.98] ${
                isActive
                  ? "bg-card-surface text-[#FF6600] shadow-card"
                  : "text-muted hover:-translate-y-px hover:bg-card-surface/70 hover:text-main hover:shadow-sm"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* The actual settings page content renders here */}
      <div className="mt-6">{children}</div>
    </div>
  );
}