import Link from "next/link";
import { Tag } from "lucide-react";

export function SidebarTags({ tags }: { tags: { tag: string; count: number }[] }) {
  if (tags.length === 0) return null;

  return (
    <section className="surface-card p-4">
      <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-foreground/90">
        <Tag className="size-3.5 text-primary" />
        推荐标签
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map(({ tag, count }) => (
          <Link
            key={tag}
            href={`/community?tag=${encodeURIComponent(tag)}`}
            className="inline-flex items-center gap-1 rounded-full border border-border/40 bg-card/30 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
          >
            #{tag}
            {count > 0 && (
              <span className="text-[10px] tabular-nums opacity-60">
                {count}
              </span>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
