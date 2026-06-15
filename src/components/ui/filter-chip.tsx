import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { PillTagTint } from "@/components/ui/pill-tag";

// V2: chips composed from the same 7-tint vocabulary as <PillTag>. We can't
// render <PillTag> directly because the active background needs to live on a
// clickable <Link>, not a nested <span>. So we compose the same tint tokens
// inline. The DEFAULT_ICON convention from PillTag does not apply here — chip
// labels are typically prefixed with an explicit Lucide icon or count badge.
const TINT_ACTIVE_CLASS: Record<PillTagTint, string> = {
  cyan: "bg-tag-cyan-bg text-tag-cyan-fg border-transparent",
  blue: "bg-tag-blue-bg text-tag-blue-fg border-transparent",
  violet: "bg-tag-violet-bg text-tag-violet-fg border-transparent",
  rose: "bg-tag-rose-bg text-tag-rose-fg border-transparent",
  amber: "bg-tag-amber-bg text-tag-amber-fg border-transparent",
  emerald: "bg-tag-emerald-bg text-tag-emerald-fg border-transparent",
  slate: "bg-tag-slate-bg text-tag-slate-fg border-transparent",
};

const DEFAULT_ACTIVE_CLASS =
  "bg-primary/15 text-primary border-primary/30 ring-1 ring-primary/40";

export function FilterChip({
  href,
  active,
  label,
  icon: Icon,
  count,
  tint,
  tone,
  className,
}: {
  href: string;
  active: boolean;
  label: React.ReactNode;
  icon?: LucideIcon;
  count?: number;
  /** V2 PillTag tint. Preferred. */
  tint?: PillTagTint;
  /** @deprecated V1 tailwind classes — pass `tint` instead. */
  tone?: string;
  className?: string;
}) {
  const activeClass = tint
    ? cn(TINT_ACTIVE_CLASS[tint], "ring-1 ring-primary/30")
    : tone
      ? cn(tone, "ring-1 ring-primary/40")
      : DEFAULT_ACTIVE_CLASS;
  return (
    <Link
      href={href}
      data-active={active || undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs whitespace-nowrap transition-colors",
        active
          ? activeClass
          : "border-border bg-card/40 text-muted-foreground hover:border-primary/30 hover:text-foreground",
        className,
      )}
    >
      {Icon && <Icon className="size-3.5 shrink-0" aria-hidden />}
      <span>{label}</span>
      {typeof count === "number" && (
        <span
          className={cn(
            "rounded-full px-1.5 text-[10px] tabular-nums",
            active ? "bg-foreground/15" : "bg-muted/60",
          )}
        >
          {count}
        </span>
      )}
    </Link>
  );
}

export function StatusChip({
  href,
  active,
  label,
  tint,
  tone,
  className,
}: {
  href: string;
  active: boolean;
  label: React.ReactNode;
  /** V2 PillTag tint. Preferred. */
  tint?: PillTagTint;
  /** @deprecated V1 tailwind classes — pass `tint` instead. */
  tone?: string;
  className?: string;
}) {
  const activeClass = tint
    ? cn(TINT_ACTIVE_CLASS[tint], "ring-1 ring-primary/20")
    : tone
      ? cn(tone, "ring-1 ring-primary/20")
      : "bg-muted/60 text-foreground ring-1 ring-primary/20";
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-1 text-xs whitespace-nowrap transition-colors",
        active
          ? activeClass
          : "border-border bg-card/40 text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {label}
    </Link>
  );
}
