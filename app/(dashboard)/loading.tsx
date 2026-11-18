import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 md:space-y-6">
      <div>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 h-4 w-64 max-w-full" />
      </div>

      <div className="surface-card p-5 sm:p-6">
        <Skeleton className="h-5 w-48 max-w-full" />
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Skeleton className="h-[104px] w-full" />
        <Skeleton className="h-[104px] w-full" />
        <Skeleton className="h-[104px] w-full" />
        <Skeleton className="h-[104px] w-full" />
      </section>

      <div>
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
