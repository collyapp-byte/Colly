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
      <h1 className="font-display text-2xl text-gray-900">Settings</h1>
      <p className="mt-1 text-sm text-gray-500">
        Manage your business profile and how your AI assistant talks to customers.
      </p>

      {/* Tab Navigation */}
      <div className="mt-6 flex gap-2 border-b border-gray-200 pb-2">
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
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                isActive
                  ? "border-colly bg-[#FFF4EC] text-[#FF6600]"
                  : "border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900"
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