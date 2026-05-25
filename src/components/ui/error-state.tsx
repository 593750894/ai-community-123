import { AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils";

export function ErrorState({
  title = "出错了",
  description,
  action,
  className,
}: {
  title?: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-destructive/40 bg-destructive/5 px-6 py-10 text-center",
        className,
      )}
    >
      <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-destructive/15 text-destructive">
        <AlertTriangle className="size-5" />
      </span>
      <p className="text-sm font-medium text-destructive">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-md text-xs text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  );
}

export function InlineError({
  message,
  className,
}: {
  message?: string | null;
  className?: string;
}) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-1 text-xs text-destructive",
        className,
      )}
    >
      <AlertTriangle className="size-3" />
      {message}
    </p>
  );
}
