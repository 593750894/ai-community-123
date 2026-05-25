import { ListItemSkeleton, Skeleton } from "@/components/ui/loading";

export default function CommunityLoading() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex flex-col gap-3 border-b border-border/60 px-4 py-5 sm:px-8 sm:py-7">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </header>
      <div className="px-4 py-5 sm:px-8 sm:py-6">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ListItemSkeleton key={i} />
          ))}
        </section>
      </div>
    </div>
  );
}
