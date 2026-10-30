import Image from "next/image";
import type { ReactNode } from "react";
import { Footer } from "@/components/ui/footer";

/**
 * Layout for the signed-out agent screens (signup and login). Mirrors the
 * business auth layout: a centred card under the Colly mark, with the global
 * footer at the bottom of the page.
 */
export default function AgentsPublicLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center justify-center gap-2.5">
            {/* Decorative: the "Colly" wordmark beside it carries the brand, so
                the mark is hidden from assistive tech rather than read twice. */}
            <Image
              src="/logo.svg"
              alt=""
              aria-hidden="true"
              width={40}
              height={40}
              priority
            />
            <span className="font-display text-2xl tracking-tight text-gray-900">
              Colly
            </span>
          </div>

          <p className="mb-4 text-center text-[13px] font-semibold uppercase tracking-widest text-colly">
            Agent Programme
          </p>

          {children}
        </div>
      </div>

      <Footer />
    </div>
  );
}
