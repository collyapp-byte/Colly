"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Error boundary for the dashboard shell.
 *
 * It sits inside `app/(dashboard)/layout.tsx`, so the sidebar, plan/credit chips
 * and the mobile nav keep working while the failed page is replaced by this
 * panel. Scoping the boundary here (instead of only at `app/error.tsx`) keeps a
 * single broken page — an invoice that 500s, a conversation with a bad id —
 * from throwing the whole workspace back to the marketing 404.
 *
 * Copy is deliberately non-technical: business owners see it, not developers.
 * The digest is shown so support can match it to the server log.
 */
export default function DashboardError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard] unhandled error:", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-2xl py-10">
      <div className="rounded-lg border border-gray-200 bg-surface p-6 text-center sm:p-8">
        <AlertTriangle
          className="mx-auto h-8 w-8 text-[#FF6600]"
          aria-hidden
        />

        <h1 className="mt-4 font-display text-2xl text-gray-900">
          We could not load this page
        </h1>

        <p role="alert" className="mx-auto mt-2 max-w-md text-sm text-gray-600">
          Your data is safe. This is a temporary problem on our side, so try
          again — if it keeps happening, contact support and quote the reference
          below.
        </p>

        {error.digest && (
          <p className="mt-2 text-[13px] text-gray-500">
            Reference: <span className="font-mono">{error.digest}</span>
          </p>
        )}

        <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center">
          <Button type="button" onClick={() => retry()}>
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden />
            Try again
          </Button>
          <Link
            href="/dashboard"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-gray-200 bg-white px-6 py-3 text-center text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
