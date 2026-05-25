import { CommunityHero } from "@/components/community/community-hero";
import { ChannelCategoryBar } from "@/components/community/channel-category-bar";
import { ChannelGrid } from "@/components/community/channel-grid";
import { PopularChannelGrid } from "@/components/community/popular-channel-grid";
import { LatestPostList } from "@/components/community/latest-post-list";
import { HotPostList } from "@/components/community/hot-post-list";
import { HotChannelList } from "@/components/community/hot-channel-list";
import { CommunityStatsCard } from "@/components/community/community-stats-card";
import { SidebarCreators } from "@/components/community/sidebar-creators";
import { SidebarTags } from "@/components/community/sidebar-tags";
import { BeginnerGuide } from "@/components/community/beginner-guide";
import { PublishGuideCard } from "@/components/community/publish-guide-card";
import { QuickPublishButton } from "@/components/community/quick-publish-button";
import {
  getCommunityStats,
  getHotChannels,
  getAllChannels,
  getLatestPosts,
  getHotPosts,
  getActiveCreators,
  getPopularTags,
} from "@/lib/community/queries";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

async function safeFetch<T>(fn: () => Promise<T>): Promise<{ data: T; error: false } | { data: null; error: true }> {
  try {
    return { data: await fn(), error: false };
  } catch (e) {
    console.error("[community] query failed:", e);
    return { data: null, error: true };
  }
}

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; tag?: string }>;
}) {
  const { category } = await searchParams;
  const activeCategory = category ?? "all";

  const [session, statsResult, channelsResult, allChannelsResult, latestPostsResult, hotPostsResult, creatorsResult, tagsResult] =
    await Promise.all([
      getSession().catch(() => null),
      safeFetch(getCommunityStats),
      safeFetch(getHotChannels),
      safeFetch(getAllChannels),
      safeFetch(getLatestPosts),
      safeFetch(getHotPosts),
      safeFetch(getActiveCreators),
      safeFetch(getPopularTags),
    ]);

  const signedIn = session !== null;

  return (
    <div className="flex flex-1 flex-col">
      <CommunityHero signedIn={signedIn} />

      <ChannelCategoryBar active={activeCategory} />

      {/* Mobile-only stats strip */}
      <div className="px-4 pt-6 lg:hidden">
        <CommunityStatsCard
          channelCount={statsResult.data?.channelCount ?? 0}
          postCount={statsResult.data?.postCount ?? 0}
          creatorCount={statsResult.data?.creatorCount ?? 0}
          todayPostCount={statsResult.data?.todayPostCount ?? 0}
          error={statsResult.error}
        />
      </div>

      <div className="flex gap-7 px-4 py-6 sm:px-8 sm:py-8">
        {/* Left main content */}
        <div className="min-w-0 flex-1 space-y-10">
          <ChannelGrid
            channels={allChannelsResult.data ?? []}
            error={allChannelsResult.error}
          />
          <PopularChannelGrid
            channels={channelsResult.data ?? []}
            error={channelsResult.error}
          />
          <LatestPostList
            posts={latestPostsResult.data ?? []}
            signedIn={signedIn}
            error={latestPostsResult.error}
          />
          <HotPostList
            posts={hotPostsResult.data ?? []}
            error={hotPostsResult.error}
          />
        </div>

        {/* Right sidebar */}
        <aside className="hidden w-80 shrink-0 space-y-5 lg:block">
          <CommunityStatsCard
            channelCount={statsResult.data?.channelCount ?? 0}
            postCount={statsResult.data?.postCount ?? 0}
            creatorCount={statsResult.data?.creatorCount ?? 0}
            todayPostCount={statsResult.data?.todayPostCount ?? 0}
            error={statsResult.error}
          />
          <PublishGuideCard signedIn={signedIn} />
          <HotChannelList
            channels={channelsResult.data ?? []}
            error={channelsResult.error}
          />
          <SidebarCreators
            creators={creatorsResult.data ?? []}
            error={creatorsResult.error}
          />
          <SidebarTags
            tags={tagsResult.data ?? []}
            error={tagsResult.error}
          />
          <BeginnerGuide />
        </aside>
      </div>

      <QuickPublishButton />
    </div>
  );
}
