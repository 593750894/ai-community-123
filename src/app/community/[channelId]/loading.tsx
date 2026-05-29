import { Skeleton, ListItemSkeleton } from "@/components/ui/loading";

export default function ChannelDetailLoading() {
  return (
    <div className="flex flex-1 flex-col">
      {/* Header skeleton */}
      <header className="relative overflow-hidden border-b border-border/40 px-6 py-10 sm:px-8 sm:py-12">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-fuchsia-500/6" />
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="relative space-y-5">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="size-14 rounded-xl sm:size-16" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-72" />
            </div>
          </div>
          <Skeleton className="h-10 w-full max-w-md rounded-lg" />
        </div>
      </header>

      <div className="flex flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8 xl:flex-row xl:gap-8">
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
        <aside className="w-full shrink-0 space-y-5 xl:w-80">
          {/* Stats skeleton */}
          <div className="surface-card overflow-hidden">
            <div className="border-b border-border/30 bg-gradient-to-r from-primary/8 via-transparent to-transparent px-4 py-3">
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="grid grid-cols-2 gap-2.5 p-3.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          </div>
          {/* Hot posts skeleton */}
          <div className="surface-card overflow-hidden">
            <div className="border-b border-border/30 bg-gradient-to-r from-orange-500/8 via-transparent to-transparent px-4 py-3">
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="space-y-1 p-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          </div>
          {/* Related channels skeleton */}
          <div className="surface-card overflow-hidden">
            <div className="border-b border-border/30 bg-gradient-to-r from-violet-500/8 via-transparent to-transparent px-4 py-3">
              <Skeleton className="h-4 w-28" />
            </div>
            <div className="space-y-1 p-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
