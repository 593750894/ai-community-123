import * as React from "react";

import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "surface-dashed flex flex-col items-center justify-center px-6 py-12 text-center",
        className,
      )}
    >
      {Icon && (
        <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted/40 text-muted-foreground">
          <Icon className="size-5" />
        </span>
      )}
      <p className="text-sm font-medium text-foreground/90">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-md text-xs text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  );
}
