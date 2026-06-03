import Link from "next/link";
import { ArrowRight, Bookmark, Film, Heart, MessageSquare, Sparkles } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PostCard } from "@/components/feed/post-card";
import { WorkCard } from "@/components/feed/work-card";
import { requireUser } from "@/lib/auth/guard";
import { getMeDashboard } from "@/lib/me/queries";
import { loadInteractionState } from "@/lib/interactions/queries";

export const dynamic = "force-dynamic";

export default async function MeDashboardPage() {
  const user = await requireUser("/me");
  const data = await getMeDashboard(user.id);

  const interactions = await loadInteractionState({
    postIds: data.recentPosts.map((p) => p.id),
    workIds: data.recentWorks.map((w) => w.id),
  });

  return (
    <>
      <PageHeader
        eyebrow="我的"
        title={`你好，${user.name}`}
        description="这里是你在 SeedLand · V 的个人空间：作品、互动、收藏一目了然。"
        actions={
          <Button
            size="sm"
            nativeButton={false}
            render={<Link href={`/profile/${user.id}`} />}
          >
            <Sparkles className="size-3.5" />
            查看公开主页
          </Button>
        }
      />

      <div className="space-y-6 px-4 py-5 sm:px-8 sm:py-6">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            href="/me/works"
            icon={Film}
            label="我的作品"
            value={data.counts.works}
            hint="发布到作品广场"
          />
          <StatTile
            href="/me/likes"
            icon={Heart}
            label="点赞"
            value={data.counts.likes}
            hint="我喜欢过的内容"
          />
          <StatTile
            href="/me/bookmarks"
            icon={Bookmark}
            label="收藏"
            value={data.counts.bookmarks}
            hint="稍后再看"
          />
          <StatTile
            href={`/profile/${user.id}`}
            icon={MessageSquare}
            label="社区动态"
            value={data.counts.posts}
            hint={`粉丝 ${data.counts.followers} · 关注 ${data.counts.following}`}
          />
        </section>

        <section>
          <SectionHeader
            title="最近作品"
            href="/me/works"
            count={data.counts.works}
            showAll={data.counts.works > data.recentWorks.length}
          />
          {data.recentWorks.length === 0 ? (
            <EmptyState
              icon={Film}
              title="还没有作品"
              description="上传你的第一部 AI 视频作品，让社区看到你的创作。"
              action={
                <Button
                  size="sm"
                  nativeButton={false}
                  render={<Link href="/create-work" />}
                >
                  发布作品
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {data.recentWorks.map((w) => (
                <WorkCard
                  key={w.id}
                  work={w}
                  signedIn
                  viewerId={user.id}
                  liked={interactions.likedWorkIds.has(w.id)}
                  bookmarked={interactions.bookmarkedWorkIds.has(w.id)}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <SectionHeader
            title="最近发布的帖子"
            href={`/profile/${user.id}`}
            count={data.counts.posts}
            showAll={data.counts.posts > data.recentPosts.length}
          />
          {data.recentPosts.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="还没有发布过帖子"
              description="选择一个感兴趣的频道，参与讨论或分享你的创作。"
              action={
                <Button
                  size="sm"
                  nativeButton={false}
                  render={<Link href="/create-post" />}
                >
                  发布新帖
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {data.recentPosts.map((p) => (
                <PostCard
                  key={p.id}
                  post={p}
                  showChannel
                  signedIn
                  viewerId={user.id}
                  liked={interactions.likedPostIds.has(p.id)}
                  bookmarked={interactions.bookmarkedPostIds.has(p.id)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function StatTile({
  href,
  icon: Icon,
  label,
  value,
  hint,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="group surface-card flex items-center gap-3 p-4 transition-colors hover:border-primary/40"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-xl font-semibold tabular-nums">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-0.5 truncate text-[11px] text-muted-foreground/70">
          {hint}
        </div>
      </div>
      <ArrowRight className="size-4 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
    </Link>
  );
}

function SectionHeader({
  title,
  href,
  count,
  showAll,
}: {
  title: string;
  href: string;
  count: number;
  showAll: boolean;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-sm font-medium">
        <span>{title}</span>
        <span className="text-xs text-muted-foreground">共 {count}</span>
      </h2>
      {showAll && (
        <Link
          href={href}
          className="text-xs text-primary hover:underline underline-offset-4"
        >
          查看全部 →
        </Link>
      )}
    </div>
  );
}
