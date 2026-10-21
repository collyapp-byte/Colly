import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-6">
        <Skeleton className="h-8 w-40" />
      </div>

      <div className="mb-6">
        <Skeleton className="h-32 w-full" />
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
    </div>
  );
}
