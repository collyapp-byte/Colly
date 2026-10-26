import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import type { ReactNode } from "react";
import { Footer } from "@/components/ui/footer";
import { getCurrentUser } from "@/lib/auth";
import { logout } from "@/lib/auth-actions";

/**
 * Signed-out screens: login, signup, password reset, email verification.
 * They are thin, near-duplicate forms that must not compete with the marketing
 * pages in search results, so the whole group is marked noindex. `/signup` is
 * therefore absent from `app/sitemap.ts` too.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * The "Not you? Sign out" control. Only rendered when a real Supabase session
 * maps to a user, so a brand-new visitor with no session never sees it. Kept in
 * its own component and wrapped in <Suspense> because reading the session
 * touches cookies(), which blocks prerendering otherwise.
 */
async function SessionSignOut() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <form
      action={logout}
      className="mt-4 border-t border-gray-200 pt-4 text-center"
    >
      <button
        type="submit"
        className="text-sm font-medium text-colly transition-colors hover:text-colly-hover"
      >
        Not you? Sign out
      </button>
    </form>
  );
}

/**
 * Layout for the signed-out screens. The dashboard's sidebar and top bar don't
 * apply here, so this is just a centred card with the brand above it, plus the
 * global footer pinned to the bottom of the page.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center justify-center gap-2.5">
            <Image src="/logo.svg" alt="Colly" width={40} height={40} priority />
            <span className="font-display text-2xl tracking-tight text-gray-900">
              Colly
            </span>
          </div>

          {children}

          <Suspense fallback={null}>
            <SessionSignOut />
          </Suspense>
        </div>
      </div>

      <Footer />
    </div>
  );
}
