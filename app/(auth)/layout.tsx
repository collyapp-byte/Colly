import Image from "next/image";
import type { ReactNode } from "react";

/**
 * Layout for the signed-out screens. The dashboard's sidebar and top bar don't
 * apply here, so this is just a centred card with the brand above it.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
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
  );
}
