import Link from "next/link";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { key: "all", label: "全部" },
  { key: "hot", label: "热门" },
  { key: "new", label: "最新" },
  { key: "tech", label: "技术" },
  { key: "creative", label: "创意" },
  { key: "collab", label: "合作" },
] as const;

export function ChannelCategoryBar({ active = "all" }: { active?: string }) {
  return (
    <nav className="flex gap-1.5 overflow-x-auto scroll-x-snap border-b border-border/30 px-6 py-3 sm:px-8">
      {CATEGORIES.map((cat) => (
        <Link
          key={cat.key}
          href={cat.key === "all" ? "/community" : `/community?category=${cat.key}`}
          className={cn(
            "shrink-0 rounded-full border px-3.5 py-1 text-xs font-medium transition-colors",
            active === cat.key
              ? "border-primary/40 bg-primary/15 text-primary shadow-sm shadow-primary/10"
              : "border-border/40 bg-card/30 text-muted-foreground hover:border-primary/30 hover:bg-card/60 hover:text-foreground",
          )}
        >
          {cat.label}
        </Link>
      ))}
    </nav>
  );
}
