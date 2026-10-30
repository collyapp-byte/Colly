import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Footer } from "@/components/ui/footer";

/**
 * Layout for the always-public pages (legal pages, account deletion, agent
 * directory). No session is required, so this is a slim header with the brand
 * and a sign-in link, the page column, and the global footer.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-gray-100 bg-white">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4">
          <Link href="/login" className="flex items-center gap-2">
            {/* Decorative: the word "Colly" beside it names the link, so the
                image is hidden from assistive tech instead of repeating it. */}
            <Image
              src="/logo.svg"
              alt=""
              aria-hidden="true"
              width={30}
              height={30}
              priority
            />
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
            <Link
              href="/login"
              className="rounded-lg bg-colly px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-colly-hover"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
