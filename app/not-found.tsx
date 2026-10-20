import Image from "next/image";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="flex flex-col items-center text-center">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <Image src="/logo.svg" alt="Colly" width={48} height={48} priority />
          <span className="font-display text-3xl tracking-tight text-gray-900">
            Colly
          </span>
        </div>

        <h1 className="font-display text-7xl tracking-tight text-[#FF6600] sm:text-8xl">
          404
        </h1>
        <h2 className="mt-4 font-display text-2xl text-gray-900 sm:text-3xl">
          Page not found
        </h2>
        <p className="mt-3 max-w-md text-sm text-gray-600 sm:text-base">
          We could not find that page. It may have been moved, deleted, or the
          URL was mistyped.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="w-full rounded-lg bg-[#FF6600] px-6 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-[#E65C00] sm:w-auto"
          >
            Go to Homepage
          </Link>
          <Link
            href="/dashboard"
            className="w-full rounded-lg border border-gray-200 bg-white px-6 py-2.5 text-center text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 sm:w-auto"
          >
            Go to Dashboard
          </Link>
        </div>

        <div className="mt-8 flex items-center gap-2 text-[13px] text-gray-500">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          If you reached this from a saved link, try going back or using one of
          the buttons above.
        </div>
      </div>
    </div>
  );
}
