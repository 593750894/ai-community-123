import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageSquare, Sparkles, Users } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PostCard, type PostCardData } from "@/components/feed/post-card";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { loadInteractionState } from "@/lib/interactions/queries";

export const dynamic = "force-dynamic";

async function getChannel(channelId: string) {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: {
      _count: { select: { posts: true, members: true } },
      owner: { select: { id: true, name: true, username: true } },
    },
  });
  return channel;
}

async function getChannelPosts(channelId: string): Promise<PostCardData[]> {
  const posts = await prisma.post.findMany({
    where: { channelId },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    include: {
      author: {
        select: { id: true, name: true, username: true, avatar: true },
      },
    },
  });
  return posts.map((p) => ({
    id: p.id,
    title: p.title,
    content: p.content,
    type: p.type,
    videoUrl: p.videoUrl,
    imageUrl: p.imageUrl,
    views: p.views,
    likeCount: p.likeCount,
    commentCount: p.commentCount,
    pinned: p.pinned,
    createdAt: p.createdAt,
    author: p.author,
  }));
}

export default async function ChannelDetailPage({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { channelId } = await params;
  const channel = await getChannel(channelId);
  if (!channel) notFound();

  const posts = await getChannelPosts(channelId);
  const session = await getSession();
  const interactions = await loadInteractionState({
    postIds: posts.map((p) => p.id),
  });
  const signedIn = Boolean(session);

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        eyebrow={`${channel.icon ?? "#"} 频道 · ${channel.slug}`}
        title={channel.name}
        description={
          channel.description ??
          `由 ${channel.owner.name} 创建的频道，等待你的第一帖。`
        }
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/community" />}
            >
              <ArrowLeft className="size-3.5" />
              全部频道
            </Button>
            <Button
              size="sm"
              nativeButton={false}
              render={
                <Link href={`/create-post?channelId=${channel.id}`} />
              }
            >
              <Sparkles className="size-3.5" />
              在此频道发帖
            </Button>
          </>
        }
      />

      <div className="space-y-5 px-4 py-5 sm:px-8 sm:py-6">
        <div className="surface-card flex flex-wrap items-center gap-4 px-4 py-3 text-xs text-muted-foreground">
          <span
            className="flex size-10 items-center justify-center rounded-lg text-xl"
            style={{
              backgroundColor: `${channel.color}20`,
              color: channel.color,
            }}
          >
            {channel.icon ?? "#"}
          </span>
          <div className="flex items-center gap-1.5">
            <MessageSquare className="size-3.5" />
            <span className="tabular-nums text-foreground/80">
              {channel._count.posts}
            </span>
            <span>个帖子</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="size-3.5" />
            <span className="tabular-nums text-foreground/80">
              {channel._count.members}
            </span>
            <span>位成员</span>
          </div>
          <div className="ml-auto">
            创建者：
            <Link
              href={`/profile/${channel.owner.id}`}
              className="ml-1 text-foreground/80 hover:text-primary"
            >
              {channel.owner.name}
            </Link>
          </div>
        </div>

        {posts.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="这个频道还没有帖子"
            description="成为第一个在这个频道发帖的人，分享你的工作流或问题。"
            action={
              <Button
                size="sm"
                nativeButton={false}
                render={<Link href={`/create-post?channelId=${channel.id}`} />}
              >
                <Sparkles className="size-3.5" />
                发布第一帖
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-muted-foreground">
                按发布时间排序 · 共 {posts.length} 帖
              </h2>
            </div>
            <ul className="space-y-3">
              {posts.map((post) => (
                <li key={post.id} id={`post-${post.id}`}>
                  <PostCard
                    post={post}
                    signedIn={signedIn}
                    liked={interactions.likedPostIds.has(post.id)}
                    bookmarked={interactions.bookmarkedPostIds.has(post.id)}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
