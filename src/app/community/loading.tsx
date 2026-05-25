import { ListItemSkeleton, Skeleton } from "@/components/ui/loading";

export default function CommunityLoading() {
  return (
    <div className="flex flex-1 flex-col">
      {/* Hero */}
      <section className="border-b border-border/60 px-6 py-8 sm:px-8 sm:py-10">
        <Skeleton className="mb-2 h-5 w-20 rounded-full" />
        <Skeleton className="mb-2 h-8 w-64" />
        <Skeleton className="mb-4 h-4 w-96" />
        <div className="flex gap-4">
          <Skeleton className="h-10 w-28 rounded-lg" />
          <Skeleton className="h-10 w-28 rounded-lg" />
          <Skeleton className="h-10 w-28 rounded-lg" />
        </div>
      </section>

      <div className="space-y-8 px-4 py-6 sm:px-8">
        {/* Popular channels */}
        <section className="space-y-3">
          <Skeleton className="h-5 w-24" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <ListItemSkeleton key={i} />
            ))}
          </div>
        </section>

        {/* Posts */}
        <section className="space-y-3">
          <Skeleton className="h-5 w-24" />
          <div className="grid gap-3 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <ListItemSkeleton key={i} />
            ))}
          </div>
        </section>

        {/* Creators */}
        <section className="space-y-3">
          <Skeleton className="h-5 w-28" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
