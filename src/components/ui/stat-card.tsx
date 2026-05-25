import * as React from "react";

import { cn } from "@/lib/utils";

export type StatCardItem = {
  label: string;
  value: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: string;
  hint?: React.ReactNode;
};

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "text-primary",
  hint,
  className,
}: StatCardItem & { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border/60 bg-card/40 p-4 transition-colors hover:border-primary/30",
        className,
      )}
    >
      {Icon && (
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10",
            tone,
          )}
        >
          <Icon className="size-4" />
        </span>
      )}
      <div className="min-w-0">
        <div className="truncate text-[11px] text-muted-foreground">{label}</div>
        <div className="truncate text-lg font-semibold tabular-nums">
          {value}
        </div>
        {hint && (
          <div className="truncate text-[10px] text-muted-foreground/80">{hint}</div>
        )}
      </div>
    </div>
  );
}
