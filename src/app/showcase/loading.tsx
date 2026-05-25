import { CardSkeleton, Skeleton } from "@/components/ui/loading";

export default function ShowcaseLoading() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex flex-col gap-3 border-b border-border/60 px-4 py-5 sm:px-8 sm:py-7">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </header>
      <div className="space-y-5 px-4 py-5 sm:px-8 sm:py-6">
        <div className="surface-card p-4">
          <Skeleton className="mb-3 h-4 w-32" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-20 rounded-full" />
            ))}
          </div>
        </div>
        <section className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </section>
      </div>
    </div>
  );
}
