import { Skeleton, ListItemSkeleton } from "@/components/ui/loading";

export default function ChannelDetailLoading() {
  return (
    <div className="flex flex-1 flex-col">
      {/* Header skeleton */}
      <header className="border-b border-border/40 px-6 py-8 sm:px-8 sm:py-10">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-12 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Skeleton className="size-12 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div className="mt-4 flex gap-4">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
      </header>

      <div className="flex gap-6 px-4 py-5 sm:px-8 sm:py-6">
        {/* Main */}
        <div className="min-w-0 flex-1 space-y-4">
          {/* Type filter skeleton */}
          <div className="flex gap-1.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-16 rounded-full" />
            ))}
          </div>
          {/* Sort + search skeleton */}
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-28 rounded-lg" />
            <Skeleton className="h-8 w-56 rounded-lg" />
          </div>
          {/* Post list skeleton */}
          {Array.from({ length: 5 }).map((_, i) => (
            <ListItemSkeleton key={i} />
          ))}
        </div>

        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 space-y-3 xl:block">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-48 rounded-xl" />
        </aside>
      </div>
    </div>
  );
}
