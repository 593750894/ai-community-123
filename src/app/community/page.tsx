import Link from "next/link";
import { ChevronRight, MessageSquare, Sparkles, Users } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getChannelsWithStats() {
  const channels = await prisma.channel.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { posts: true, members: true } },
      posts: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          title: true,
          createdAt: true,
          author: { select: { name: true } },
        },
      },
    },
  });
  return channels;
}

export default async function CommunityPage() {
  const channels = await getChannelsWithStats();
  const totalPosts = channels.reduce((sum, c) => sum + c._count.posts, 0);
  const totalMembers = channels.reduce((sum, c) => sum + c._count.members, 0);

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        eyebrow="社区总览"
        title="Community · 频道索引"
        description={`${channels.length} 个频道 · ${totalPosts} 个帖子 · ${totalMembers} 人参与。选一个频道开始浏览，或者直接发帖参与讨论。`}
        actions={
          <Button size="sm" nativeButton={false} render={<Link href="/create-post" />}>
            <Sparkles className="size-3.5" />
            发布帖子
          </Button>
        }
      />

      <div className="space-y-6 px-4 py-5 sm:px-8 sm:py-6">
        {channels.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="还没有频道"
            description="社区频道由管理员创建。等待管理员开通后再来浏览，或先发表你的第一帖。"
            action={
              <Button size="sm" nativeButton={false} render={<Link href="/create-post" />}>
                <Sparkles className="size-3.5" />
                发布帖子
              </Button>
            }
          />
        ) : (
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {channels.map((c) => {
              const latest = c.posts[0];
              return (
                <Link
                  key={c.id}
                  href={`/community/${c.id}`}
                  className="group surface-card surface-card-hover relative overflow-hidden p-4 transition-all hover:-translate-y-0.5"
                  style={{
                    boxShadow: `inset 0 1px 0 ${c.color}25`,
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-lg text-lg"
                        style={{
                          backgroundColor: `${c.color}20`,
                          color: c.color,
                        }}
                      >
                        {c.icon ?? "#"}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold leading-tight">
                          {c.name}
                        </div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {c.slug}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="size-4 shrink-0 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                  </div>

                  {c.description && (
                    <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">
                      {c.description}
                    </p>
                  )}

                  <div className="mt-3 flex items-center gap-3 border-t border-border/40 pt-3 text-[11px] text-muted-foreground tabular-nums">
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
                    <div className="mt-2 truncate text-[11px] text-muted-foreground/80">
                      最新：
                      <span className="ml-1 text-foreground/70">{latest.title}</span>
                    </div>
                  )}
                </Link>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}
