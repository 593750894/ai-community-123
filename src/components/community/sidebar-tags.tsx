import Link from "next/link";
import { Sparkles, Tags } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { InlineError } from "@/components/ui/error-state";

const TAG_COLORS = [
  "hover:border-violet-400/40 hover:bg-violet-500/10 hover:text-violet-400",
  "hover:border-cyan-400/40 hover:bg-cyan-500/10 hover:text-cyan-400",
  "hover:border-amber-400/40 hover:bg-amber-500/10 hover:text-amber-400",
  "hover:border-emerald-400/40 hover:bg-emerald-500/10 hover:text-emerald-400",
  "hover:border-rose-400/40 hover:bg-rose-500/10 hover:text-rose-400",
  "hover:border-blue-400/40 hover:bg-blue-500/10 hover:text-blue-400",
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
        推荐标签
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
              className={`inline-flex items-center gap-1 rounded-full border border-border/40 bg-card/30 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors ${TAG_COLORS[i % TAG_COLORS.length]}`}
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
