import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageSquare, Sparkles } from "lucide-react";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PostCard, type PostCardData } from "@/components/feed/post-card";
import { ChannelHeader } from "@/components/community/channel/channel-header";
import { ChannelHotPosts } from "@/components/community/channel/channel-hot-posts";
import { PostTypeFilter } from "@/components/community/channel/post-type-filter";
import { PostSortSelect } from "@/components/community/channel/post-sort-select";
import { ChannelSearchBar } from "@/components/community/channel/channel-search-bar";
import { PostPagination } from "@/components/community/channel/post-pagination";
import {
  getChannelDetail,
  getChannelPosts,
  getChannelHotPosts,
} from "@/lib/community/queries";
import { getSession } from "@/lib/auth/session";
import { loadInteractionState } from "@/lib/interactions/queries";

export const dynamic = "force-dynamic";

function toPostCard(p: {
  id: string;
  title: string;
  contentPreview: string;
  type: string;
  videoUrl: string | null;
  imageUrl: string | null;
  views: number;
  likeCount: number;
  commentCount: number;
  pinned: boolean;
  createdAt: string;
  author: { id: string; name: string; username: string; avatar: string | null };
}): PostCardData {
  return {
    id: p.id,
    title: p.title,
    content: p.contentPreview,
    type: p.type as PostCardData["type"],
    videoUrl: p.videoUrl,
    imageUrl: p.imageUrl,
    views: p.views,
    likeCount: p.likeCount,
    commentCount: p.commentCount,
    pinned: p.pinned,
    createdAt: p.createdAt,
    author: p.author,
  };
}

export default async function ChannelDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ channelId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { channelId } = await params;
  const sp = await searchParams;

  const channel = await getChannelDetail(channelId);
  if (!channel) notFound();

  const type = typeof sp.type === "string" ? sp.type : undefined;
  const sort =
    typeof sp.sort === "string" && sp.sort === "hot" ? "hot" : "latest";
  const search = typeof sp.q === "string" ? sp.q : undefined;
  const page = typeof sp.page === "string" ? Math.max(1, parseInt(sp.page, 10) || 1) : 1;

  const [result, hotPosts, session] = await Promise.all([
    getChannelPosts(channel.id, { type, sort: sort as "latest" | "hot", search, page }),
    getChannelHotPosts(channel.id),
    getSession(),
  ]);

  const interactions = await loadInteractionState({
    postIds: result.posts.map((p) => p.id),
  });
  const signedIn = Boolean(session);

  const hasFilters = Boolean(type || search || sort !== "latest");
  const publishHref = signedIn
    ? `/create-post?channelId=${channel.id}`
    : `/auth/login?next=/create-post?channelId=${channel.id}`;

  return (
    <div className="flex flex-1 flex-col">
      <ChannelHeader channel={channel} signedIn={signedIn} />

      <div className="flex gap-6 px-4 py-5 sm:px-8 sm:py-6">
        {/* Main content */}
        <div className="min-w-0 flex-1 space-y-4">
          {/* Toolbar: filter + sort + search */}
          <div className="space-y-3">
            <Suspense>
              <PostTypeFilter current={type} />
            </Suspense>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Suspense>
                <PostSortSelect current={sort} />
              </Suspense>
              <Suspense>
                <ChannelSearchBar current={search} />
              </Suspense>
            </div>
          </div>

          {/* Search indicator */}
          {search && (
            <p className="text-xs text-muted-foreground">
              搜索 &ldquo;{search}&rdquo; · 共 {result.total} 条结果
            </p>
          )}

          {/* Posts */}
          {result.posts.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title={
                hasFilters
                  ? "没有找到匹配的帖子"
                  : "这个频道还没有帖子"
              }
              description={
                hasFilters
                  ? "试试调整筛选条件或搜索关键词。"
                  : "成为第一个在这个频道发帖的人，分享你的工作流或问题。"
              }
              action={
                !hasFilters ? (
                  <Button
                    size="sm"
                    nativeButton={false}
                    render={<Link href={publishHref} />}
                  >
                    <Sparkles className="size-3.5" />
                    发布第一帖
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-xs text-muted-foreground">
                  {sort === "hot" ? "按热度排序" : "按发布时间排序"} · 共{" "}
                  {result.total} 帖
                </h2>
              </div>
              <ul className="space-y-3">
                {result.posts.map((post) => (
                  <li key={post.id} id={`post-${post.id}`}>
                    <PostCard
                      post={toPostCard(post)}
                      signedIn={signedIn}
                      liked={interactions.likedPostIds.has(post.id)}
                      bookmarked={interactions.bookmarkedPostIds.has(post.id)}
                    />
                  </li>
                ))}
              </ul>
              <PostPagination
                page={result.page}
                totalPages={result.totalPages}
              />
            </>
          )}
        </div>

        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 space-y-5 xl:block">
          <ChannelHotPosts posts={hotPosts} />
        </aside>
      </div>
    </div>
  );
}
