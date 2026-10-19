import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Footer } from "@/components/ui/footer";
import { NavbarAuthActions } from "@/components/marketing/navbar-auth-actions";

/**
 * Shell for the public marketing pages: brand header with the auth-aware
 * action buttons, the page column, and the global footer. No session is
 * required -- the marketing homepage is the one page a signed-out visitor
 * reaches without being bounced to /login.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.svg" alt="Colly" width={30} height={30} priority />
            <span className="font-display text-lg tracking-tight text-gray-900">
              Colly
            </span>
          </Link>
          <nav className="flex items-center gap-5">
            <Link
              href="/find-an-agent"
              className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
            >
              Find an Agent
            </Link>
            <NavbarAuthActions />
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
