import { ListItemSkeleton, Skeleton } from "@/components/ui/loading";

export default function CommunityLoading() {
  return (
    <div className="flex flex-1 flex-col">
      {/* Hero */}
      <section className="border-b border-border/60 px-6 py-10 sm:px-8 sm:py-14">
        <Skeleton className="mb-2 h-5 w-20 rounded-full" />
        <Skeleton className="mb-2 h-8 w-64" />
        <Skeleton className="mb-5 h-4 w-96" />
        <div className="flex gap-3">
          <Skeleton className="h-10 w-28 rounded-lg" />
          <Skeleton className="h-10 w-28 rounded-lg" />
        </div>
      </section>

      {/* Category bar */}
      <div className="flex gap-1.5 px-6 py-3 sm:px-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-14 rounded-full" />
        ))}
      </div>

      <div className="flex gap-6 px-4 py-6 sm:px-8">
        {/* Left column */}
        <div className="min-w-0 flex-1 space-y-8">
          <section className="space-y-3">
            <Skeleton className="h-5 w-24" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <ListItemSkeleton key={i} />
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <Skeleton className="h-5 w-24" />
            <div className="grid gap-3 lg:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <ListItemSkeleton key={i} />
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <Skeleton className="h-5 w-24" />
            {Array.from({ length: 3 }).map((_, i) => (
              <ListItemSkeleton key={i} />
            ))}
          </section>
        </div>

        {/* Right column */}
        <aside className="hidden w-72 shrink-0 space-y-4 xl:block">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
        </aside>
      </div>
    </div>
  );
}
