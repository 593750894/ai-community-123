import Link from "next/link";
import { Sparkles, Tags } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { InlineError } from "@/components/ui/error-state";

const TAG_COLORS = [
  "hover:border-tag-violet-fg/50 hover:bg-tag-violet-bg/10 hover:text-tag-violet-fg dark:hover:border-violet-400/40 dark:hover:text-violet-400",
  "hover:border-tag-cyan-fg/50 hover:bg-tag-cyan-bg/10 hover:text-tag-cyan-fg dark:hover:border-cyan-400/40 dark:hover:text-cyan-400",
  "hover:border-tag-amber-fg/50 hover:bg-tag-amber-bg/10 hover:text-tag-amber-fg dark:hover:border-amber-400/40 dark:hover:text-amber-400",
  "hover:border-tag-emerald-fg/50 hover:bg-tag-emerald-bg/10 hover:text-tag-emerald-fg dark:hover:border-emerald-400/40 dark:hover:text-emerald-400",
  "hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive dark:hover:border-rose-400/40 dark:hover:text-rose-400",
  "hover:border-tag-blue-fg/50 hover:bg-tag-blue-bg/10 hover:text-tag-blue-fg dark:hover:border-blue-400/40 dark:hover:text-blue-400",
];

export function SidebarTags({
  tags,
  error = false,
}: {
  tags: { tag: string; count: number }[];
  error?: boolean;
}) {
  return (
    <section className="surface-card p-4">
      <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-foreground/90">
        <Sparkles className="size-3.5 text-primary" />
        推荐话题
      </div>

      {error ? (
        <InlineError message="标签数据加载失败" />
      ) : tags.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="暂无推荐标签"
          description="发布内容并添加标签，热门标签将展示在这里。"
          className="border-none bg-transparent py-6"
        />
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {tags.map(({ tag, count }, i) => (
            <Link
              key={tag}
              href={`/community?tag=${encodeURIComponent(tag)}`}
              className={`inline-flex items-center gap-1 rounded-full border border-border bg-card/20 px-2.5 py-1 text-[11px] text-muted-foreground transition-all ${TAG_COLORS[i % TAG_COLORS.length]}`}
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
      )}
    </section>
  );
}
