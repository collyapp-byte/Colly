"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Route-level error boundary for everything under `app/`.
 *
 * Next renders this instead of the page when a Server or Client Component throws
 * below the root layout, so the header/footer of the current segment survive and
 * the user gets a way out instead of the framework's bare error page.
 *
 * `retry()` (not the pre-16.3 `reset()`) re-fetches and re-renders the boundary's
 * children, which is what a transient database or provider failure needs.
 *
 * Accessibility: the message is announced once through `role="alert"`, the
 * heading is the first focusable landmark, and both actions are real 44 px
 * targets (the shared `Button` base styles + a `Link` with the same padding).
 */
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // Server Component errors arrive with a generic message and a digest; the
    // full stack is only in the server logs, so log what the client can see.
    console.error("[app] unhandled error:", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <AlertTriangle className="h-9 w-9 text-[#FF6600]" aria-hidden />

        <h1 className="mt-4 font-display text-2xl text-gray-900 sm:text-3xl">
          Something went wrong
        </h1>

        <p role="alert" className="mt-3 text-sm text-gray-600 sm:text-base">
          This page could not load. It is usually temporary, so try again in a
          moment. Nothing you saved has been lost.
        </p>

        {error.digest && (
          <p className="mt-2 text-[13px] text-gray-500">
            Reference: <span className="font-mono">{error.digest}</span>
          </p>
        )}

        <div className="mt-8 flex w-full flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center">
          <Button type="button" onClick={() => retry()}>
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden />
            Try Again
          </Button>
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-gray-200 bg-white px-6 py-3 text-center text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            Go to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
