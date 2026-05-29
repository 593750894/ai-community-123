import { notFound } from "next/navigation";
import { Suspense } from "react";

import type { PostCardData } from "@/components/feed/post-card";
import { ChannelHeader } from "@/components/community/channel/channel-header";
import { ChannelPostList } from "@/components/community/ChannelPostList";
import { ChannelRightPanel } from "@/components/community/ChannelRightPanel";
import { ChannelFilters } from "@/components/community/ChannelFilters";
import {
  getChannelDetail,
  getChannelPosts,
  getChannelHotPosts,
  getChannelStats,
  getRelatedChannels,
} from "@/lib/community/queries";
import type { ChannelPostSort, ChannelStats, PostOverview, ChannelOverview } from "@/types/community";
import { POST_TYPE_VALUES } from "@/lib/post-types";
import { getSession } from "@/lib/auth/session";
import { loadInteractionState } from "@/lib/interactions/queries";

const VALID_SORTS = new Set<ChannelPostSort>(["latest", "hot", "mostCommented", "mostLiked"]);
const VALID_TYPES = new Set<string>(POST_TYPE_VALUES);
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

const EMPTY_STATS: ChannelStats = { postCount: 0, todayPostCount: 0, creatorCount: 0, hotPostCount: 0 };

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

async function safeFetch<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.error("[channel-detail] sidebar fetch failed:", e);
    return fallback;
  }
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

  const rawType = typeof sp.type === "string" ? sp.type : undefined;
  const type = rawType && VALID_TYPES.has(rawType) ? rawType : undefined;

  const sortParam = typeof sp.sort === "string" ? sp.sort : "latest";
  const sort: ChannelPostSort = VALID_SORTS.has(sortParam as ChannelPostSort)
    ? (sortParam as ChannelPostSort)
    : "latest";
  const search = typeof sp.q === "string" ? sp.q : undefined;
  const rawPage = typeof sp.page === "string" ? Math.max(1, parseInt(sp.page, 10) || 1) : 1;
  const pageSize = typeof sp.pageSize === "string"
    ? Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(sp.pageSize, 10) || DEFAULT_PAGE_SIZE))
    : DEFAULT_PAGE_SIZE;

  const [result, hotPosts, channelStats, relatedChannels, session] = await Promise.all([
    getChannelPosts(channel.id, { type, sort, search, page: rawPage, limit: pageSize }),
    safeFetch<PostOverview[]>(() => getChannelHotPosts(channel.id), []),
    safeFetch<ChannelStats>(() => getChannelStats(channel.id), EMPTY_STATS),
    safeFetch<ChannelOverview[]>(() => getRelatedChannels(channel.id, channel.slug), []),
    getSession(),
  ]);

  const page = result.totalPages > 0 ? Math.min(rawPage, result.totalPages) : 1;
  const clampedPosts = page !== rawPage
    ? (await getChannelPosts(channel.id, { type, sort, search, page, limit: pageSize })).posts
    : result.posts;

  const interactions = await loadInteractionState({
    postIds: clampedPosts.map((p) => p.id),
  });
  const signedIn = Boolean(session);

  const hasFilters = Boolean(type || search || sort !== "latest");
  const createPostPath = `/create-post?channelId=${channel.id}`;
  const publishHref = signedIn
    ? createPostPath
    : `/auth/login?next=${encodeURIComponent(createPostPath)}`;

  return (
    <div className="flex flex-1 flex-col">
      <ChannelHeader channel={channel} stats={channelStats} signedIn={signedIn} />

      <div className="flex flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8 xl:flex-row xl:gap-8">
        {/* Main content */}
        <div className="min-w-0 flex-1 space-y-4">
          <Suspense>
            <ChannelFilters type={type} sort={sort} search={search} />
          </Suspense>

          <ChannelPostList
            posts={clampedPosts.map(toPostCard)}
            total={result.total}
            sort={sort}
            page={page}
            totalPages={result.totalPages}
            search={search}
            hasFilters={hasFilters}
            publishHref={publishHref}
            channelSlug={channel.slug}
            signedIn={signedIn}
            interactions={interactions}
          />
        </div>

        <ChannelRightPanel
          stats={channelStats}
          hotPosts={hotPosts}
          relatedChannels={relatedChannels}
          channelId={channel.id}
        />
      </div>
    </div>
  );
}
