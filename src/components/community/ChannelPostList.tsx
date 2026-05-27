import Link from "next/link";
import { MessageSquare, Search, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PostCard, type PostCardData } from "@/components/feed/post-card";
import { PostPagination } from "@/components/community/channel/post-pagination";
import { getPublishLabel } from "@/lib/community/channel-categories";
import type { ChannelPostSort } from "@/types/community";

const SORT_LABELS: Record<ChannelPostSort, string> = {
  latest: "按发布时间排序",
  hot: "按热度排序",
  mostCommented: "按评论数排序",
  mostLiked: "按点赞数排序",
};

export function ChannelPostList({
  posts,
  total,
  sort,
  page,
  totalPages,
  search,
  hasFilters,
  publishHref,
  channelSlug,
  signedIn,
  interactions,
}: {
  posts: PostCardData[];
  total: number;
  sort: ChannelPostSort;
  page: number;
  totalPages: number;
  search?: string;
  hasFilters: boolean;
  publishHref: string;
  channelSlug: string;
  signedIn: boolean;
  interactions: {
    likedPostIds: Set<string>;
    bookmarkedPostIds: Set<string>;
  };
}) {
  const publishLabel = getPublishLabel(channelSlug);

  if (posts.length === 0) {
    if (search) {
      return (
        <EmptyState
          icon={Search}
          title="没有找到相关讨论"
          description="没有找到相关讨论，换个关键词试试。"
        />
      );
    }
    if (hasFilters) {
      return (
        <EmptyState
          icon={MessageSquare}
          title="没有找到匹配的帖子"
          description="试试调整筛选条件，或清除所有筛选查看全部内容。"
        />
      );
    }
    return (
      <EmptyState
        icon={MessageSquare}
        title="这个频道还没有讨论"
        description="这个频道还没有讨论，成为第一个发起话题的人。"
        action={
          <Button
            size="sm"
            nativeButton={false}
            render={<Link href={publishHref} />}
          >
            <Sparkles className="size-3.5" />
            {publishLabel}
          </Button>
        }
      />
    );
  }

  return (
    <>
      <div className="flex items-center justify-between rounded-lg border border-border/25 bg-card/20 px-4 py-2.5">
        <h2 className="flex items-center gap-2 text-xs text-muted-foreground">
          {search ? (
            <>
              搜索 &ldquo;{search}&rdquo;
              <span className="h-3 w-px bg-border/60" />
              <span className="tabular-nums">共 {total} 条结果</span>
            </>
          ) : (
            <>
              <span>{SORT_LABELS[sort]}</span>
              <span className="h-3 w-px bg-border/60" />
              <span className="tabular-nums font-medium text-foreground/80">
                {total}
              </span>
              <span>帖</span>
            </>
          )}
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

      <PostPagination page={page} totalPages={totalPages} />
    </>
  );
}
