import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      data-slot="spinner"
      aria-hidden="true"
      className={cn("size-4 animate-spin text-muted-foreground", className)}
    />
  );
}

export function LoadingState({
  label = "加载中…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-border/60 bg-card/30 px-6 py-12 text-center",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Spinner className="size-6 text-primary" />
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "rounded-md bg-muted/30 animate-skeleton",
        className,
      )}
    />
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("surface-card p-3", className)}>
      <Skeleton className="aspect-video w-full rounded-lg" />
      <Skeleton className="mt-3 h-4 w-3/4" />
      <Skeleton className="mt-2 h-3 w-1/2" />
      <div className="mt-3 flex items-center gap-2">
        <Skeleton className="size-5 rounded-full" />
        <Skeleton className="h-3 flex-1" />
      </div>
    </div>
  );
}

export function ListItemSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("surface-card p-4", className)}>
      <div className="flex items-center gap-2">
        <Skeleton className="size-4 rounded-full" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="ml-auto h-3 w-12" />
      </div>
      <Skeleton className="mt-3 h-4 w-3/4" />
      <Skeleton className="mt-2 h-3 w-full" />
      <Skeleton className="mt-1 h-3 w-2/3" />
    </div>
  );
}
