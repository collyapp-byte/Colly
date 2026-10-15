import Image from "next/image";
import type { ReactNode } from "react";

/**
 * Layout for the signed-out agent screens (signup and login). Mirrors the
 * business auth layout: a centred card under the Colly mark.
 */
export default function AgentsPublicLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <Image src="/logo.svg" alt="Colly" width={40} height={40} priority />
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
  );
}
