import Link from "next/link";
import { ChevronRight, Flame, Hash, MessageSquare, Users } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { InlineError } from "@/components/ui/error-state";

export type PopularChannelData = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string;
  _count: { posts: number; members: number };
  posts: Array<{
    id: string;
    title: string;
    createdAt: Date;
    author: { name: string };
  }>;
};

export function PopularChannelGrid({
  channels,
  error = false,
}: {
  channels: PopularChannelData[];
  error?: boolean;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="inline-flex items-center gap-1.5 text-base font-semibold">
          <Flame className="size-4 text-orange-400" />
          热门频道
        </h2>
        <Link
          href="/community"
          className="text-xs text-muted-foreground transition-colors hover:text-primary"
        >
          查看全部
        </Link>
      </div>

      {error ? (
        <InlineError message="热门频道加载失败，请稍后刷新重试" />
      ) : channels.length === 0 ? (
        <EmptyState
          icon={Hash}
          title="暂无热门频道"
          description="暂无频道，管理员正在配置社区结构。"
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {channels.map((c) => {
            const latest = c.posts[0];
            return (
              <Link
                key={c.id}
                href={`/community/${c.id}`}
                className="group surface-card relative overflow-hidden p-4 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card/60"
                style={{ borderTop: `2px solid ${c.color}50` }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-lg text-lg"
                      style={{
                        backgroundColor: `${c.color}18`,
                        color: c.color,
                      }}
                    >
                      {c.icon ?? "#"}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold leading-tight">
                        {c.name}
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground/70">
                        {c.slug}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="size-4 shrink-0 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                </div>

                {c.description && (
                  <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {c.description}
                  </p>
                )}

                <div className="mt-3 flex items-center gap-3 border-t border-border/30 pt-2.5 text-[11px] text-muted-foreground tabular-nums">
                  <span className="inline-flex items-center gap-1">
                    <MessageSquare className="size-3" />
                    {c._count.posts} 帖
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-3" />
                    {c._count.members} 成员
                  </span>
                </div>

                {latest && (
                  <div className="mt-2 truncate text-[11px] text-muted-foreground/70">
                    最新：
                    <span className="ml-1 text-foreground/70">
                      {latest.title}
                    </span>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
