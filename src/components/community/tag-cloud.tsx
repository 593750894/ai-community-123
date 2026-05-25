import Link from "next/link";

export type TagData = { tag: string; count: number };

export function TagCloud({ tags }: { tags: TagData[] }) {
  if (tags.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">推荐标签</h2>

      <div className="flex flex-wrap gap-2">
        {tags.map(({ tag, count }) => (
          <Link
            key={tag}
            href={`/community?tag=${encodeURIComponent(tag)}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-card/50 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
          >
            <span>#</span>
            <span>{tag}</span>
            <span className="text-[10px] tabular-nums opacity-60">
              {count}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
