import Image from "next/image";
import type { ReactNode } from "react";
import { Footer } from "@/components/ui/footer";

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
        </div>
      </div>

      <Footer />
    </div>
  );
}
