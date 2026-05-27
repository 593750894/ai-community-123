import { notFound } from "next/navigation";
import { Suspense } from "react";

import type { PostCardData } from "@/components/feed/post-card";
import { ChannelHeader } from "@/components/community/channel/channel-header";
import { ChannelPostList } from "@/components/community/ChannelPostList";
import { ChannelHotPosts } from "@/components/community/channel/channel-hot-posts";
import { ChannelStatsCard } from "@/components/community/channel/channel-stats-card";
import { RelatedChannels } from "@/components/community/channel/related-channels";
import { ChannelBeginnerGuide } from "@/components/community/channel/channel-beginner-guide";
import { PostTypeFilter } from "@/components/community/channel/post-type-filter";
import { PostSortSelect } from "@/components/community/channel/post-sort-select";
import { ChannelSearchBar } from "@/components/community/channel/channel-search-bar";
import {
  getChannelDetail,
  getChannelPosts,
  getChannelHotPosts,
  getChannelStats,
  getRelatedChannels,
} from "@/lib/community/queries";
import type { ChannelPostSort } from "@/types/community";
import { getSession } from "@/lib/auth/session";
import { loadInteractionState } from "@/lib/interactions/queries";

const VALID_SORTS = new Set<ChannelPostSort>(["latest", "hot", "mostCommented", "mostLiked"]);

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
  bookmarkCount: number;
  pinned: boolean;
  createdAt: string;
  author: { id: string; name: string; username: string; avatar: string | null; role: string };
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
    bookmarkCount: p.bookmarkCount,
    pinned: p.pinned,
    createdAt: p.createdAt,
    author: {
      id: p.author.id,
      name: p.author.name,
      username: p.author.username,
      avatar: p.author.avatar,
      role: p.author.role as PostCardData["author"]["role"],
    },
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
  const sortParam = typeof sp.sort === "string" ? sp.sort : "latest";
  const sort: ChannelPostSort = VALID_SORTS.has(sortParam as ChannelPostSort)
    ? (sortParam as ChannelPostSort)
    : "latest";
  const search = typeof sp.q === "string" ? sp.q : undefined;
  const page = typeof sp.page === "string" ? Math.max(1, parseInt(sp.page, 10) || 1) : 1;

  const [result, hotPosts, channelStats, relatedChannels, session] = await Promise.all([
    getChannelPosts(channel.id, { type, sort, search, page }),
    getChannelHotPosts(channel.id),
    getChannelStats(channel.id),
    getRelatedChannels(channel.id, channel.slug),
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
      <ChannelHeader channel={channel} stats={channelStats} signedIn={signedIn} />

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

          {/* Posts */}
          <ChannelPostList
            posts={result.posts.map(toPostCard)}
            total={result.total}
            sort={sort}
            page={result.page}
            totalPages={result.totalPages}
            search={search}
            hasFilters={hasFilters}
            publishHref={publishHref}
            signedIn={signedIn}
            interactions={interactions}
          />
        </div>

        {/* Sidebar */}
        <aside className="hidden w-80 shrink-0 space-y-5 xl:block">
          <ChannelStatsCard stats={channelStats} />
          <ChannelHotPosts posts={hotPosts} />
          <RelatedChannels channels={relatedChannels} />
          <ChannelBeginnerGuide channelId={channel.id} />
        </aside>
      </div>
    </div>
  );
}
