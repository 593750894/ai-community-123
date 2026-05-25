import Link from "next/link";
import { Flame, Hash, MessageSquare } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { InlineError } from "@/components/ui/error-state";

export type HotChannelData = {
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

function isRecentlyActive(channel: HotChannelData): boolean {
  if (channel.posts.length === 0) return false;
  const last = new Date(channel.posts[0].createdAt);
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  return last >= threeDaysAgo;
}

export function HotChannelList({
  channels,
  error = false,
}: {
  channels: HotChannelData[];
  error?: boolean;
}) {
  return (
    <section className="surface-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/90">
          <Flame className="size-3.5 text-orange-400" />
          热门频道
        </div>
        <Link
          href="/community"
          className="text-[11px] text-muted-foreground transition-colors hover:text-primary"
        >
          全部
        </Link>
      </div>

      {error ? (
        <InlineError message="热门频道数据加载失败" />
      ) : channels.length === 0 ? (
        <EmptyState
          icon={Hash}
          title="暂无频道"
          description="管理员正在配置社区结构。"
          className="border-none bg-transparent py-6"
        />
      ) : (
        <ul className="space-y-1">
          {channels.map((ch) => {
            const active = isRecentlyActive(ch);

            return (
              <li key={ch.id}>
                <Link
                  href={`/community/${ch.id}`}
                  className="group flex items-start gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-muted/40"
                >
                  <span
                    className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg text-base"
                    style={{
                      backgroundColor: `${ch.color}20`,
                      color: ch.color,
                    }}
                  >
                    {ch.icon ?? "#"}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium group-hover:text-primary">
                        {ch.name}
                      </span>
                      {active && (
                        <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
                      )}
                    </div>

                    {ch.description && (
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                        {ch.description}
                      </p>
                    )}

                    <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground tabular-nums">
                      <span className="inline-flex items-center gap-0.5">
                        <MessageSquare className="size-2.5" />
                        {ch._count.posts} 帖子
                      </span>
                      {active && (
                        <span className="text-emerald-500">活跃</span>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
