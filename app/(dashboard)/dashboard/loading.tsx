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
    <div className="mx-auto w-full max-w-6xl space-y-5 md:space-y-6">
      {/* Greeting card: eyebrow, name, one-line description. */}
      <div className="surface-card p-5 md:p-6">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-3 h-8 w-52 max-w-full" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      </div>

      {/* Setup checklist: heading row plus the three step cards. */}
      <div className="rounded-2xl border border-colly/20 bg-colly-tint/40 p-5 shadow-card sm:p-6">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="mt-2 h-4 w-64 max-w-full" />
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
          <Skeleton className="h-[132px] w-full" />
          <Skeleton className="h-[132px] w-full" />
          <Skeleton className="h-[132px] w-full" />
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Skeleton className="h-[104px] w-full" />
        <Skeleton className="h-[104px] w-full" />
        <Skeleton className="h-[104px] w-full" />
        <Skeleton className="h-[104px] w-full" />
      </section>

      {/* Two-up panels, matching the trend + WhatsApp row. */}
      <div className="grid gap-5 lg:grid-cols-5">
        <Skeleton className="h-72 w-full lg:col-span-3" />
        <Skeleton className="h-72 w-full lg:col-span-2" />
      </div>
    </div>
  );
}
