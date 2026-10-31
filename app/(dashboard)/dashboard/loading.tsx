import { Skeleton } from "@/components/ui/skeleton";

/**
 * Streaming placeholder for the Overview route only.
 *
 * The page awaits `requireAuth()` and four Prisma reads behind
 * `connection()`, so on a client-side navigation Next streams this file first.
 * It therefore mirrors the real page block for block — heading, setup
 * checklist and the four stat cards. The shared `app/(dashboard)/loading.tsx`
 * (a generic ~250px card stack) is far shorter than this ~900px page, so using
 * it here meant the incoming content pushed everything below it down; matching
 * heights keeps the swap close to invisible.
 */
export default function DashboardOverviewLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-6">
        <Skeleton className="h-8 w-40" />
      </div>

      {/* Setup checklist: heading row, progress bar, three step rows. */}
      <div className="mb-6 rounded-xl border border-[#FF6600]/30 bg-[#FFF4EC] p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="w-full">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="mt-2 h-4 w-64 max-w-full" />
          </div>
          <Skeleton className="h-4 w-8 shrink-0" />
        </div>
        <Skeleton className="mt-3 h-2 w-full" />
        <div className="mt-4 space-y-2">
          <Skeleton className="h-[104px] w-full" />
          <Skeleton className="h-[104px] w-full" />
          <Skeleton className="h-[104px] w-full" />
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </section>

      <div className="mt-6">
        <Skeleton className="h-64 w-full" />
      </div>

      <div className="mt-6">
        <Skeleton className="h-52 w-full" />
      </div>
    </div>
  );
}
