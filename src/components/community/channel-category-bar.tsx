"use client";

import { cn } from "@/lib/utils";

const CATEGORIES = [
  { key: "all", label: "全部" },
  { key: "hot", label: "热门" },
  { key: "new", label: "最新" },
  { key: "tech", label: "技术" },
  { key: "creative", label: "创意" },
  { key: "collab", label: "合作" },
] as const;

export function ChannelCategoryBar({
  active = "all",
  onChange,
}: {
  active?: string;
  onChange?: (key: string) => void;
}) {
  return (
    <nav className="flex gap-1.5 overflow-x-auto px-6 py-3 sm:px-8">
      {CATEGORIES.map((cat) => (
        <button
          key={cat.key}
          onClick={() => onChange?.(cat.key)}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            active === cat.key
              ? "border-primary/40 bg-primary/15 text-primary"
              : "border-border/40 bg-card/50 text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {cat.label}
        </button>
      ))}
    </nav>
  );
}
