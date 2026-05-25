import Link from "next/link";

import { cn } from "@/lib/utils";

export function FilterChip({
  href,
  active,
  label,
  emoji,
  count,
  tone,
  className,
}: {
  href: string;
  active: boolean;
  label: React.ReactNode;
  emoji?: string;
  count?: number;
  tone?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      data-active={active || undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs whitespace-nowrap transition-colors",
        active
          ? cn(tone ?? "bg-primary/15 text-primary border-primary/30", "ring-1 ring-primary/40")
          : "border-border/60 bg-card/40 text-muted-foreground hover:border-primary/30 hover:text-foreground",
        className,
      )}
    >
      {emoji && <span aria-hidden>{emoji}</span>}
      <span>{label}</span>
      {typeof count === "number" && (
        <span
          className={cn(
            "rounded-full px-1.5 text-[10px] tabular-nums",
            active ? "bg-white/10" : "bg-muted/60",
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
  tone,
  className,
}: {
  href: string;
  active: boolean;
  label: React.ReactNode;
  tone?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-1 text-xs whitespace-nowrap transition-colors",
        active
          ? cn(tone ?? "bg-muted/60 text-foreground", "ring-1 ring-primary/20")
          : "border-border/60 bg-card/40 text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {label}
    </Link>
  );
}
