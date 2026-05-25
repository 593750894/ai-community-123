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

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; tag?: string }>;
}) {
  const { category } = await searchParams;
  const activeCategory = category ?? "all";

  const [session, stats, channels, allChannels, latestPosts, hotPosts, creators, tags] =
    await Promise.all([
      getSession(),
      getCommunityStats(),
      getHotChannels(),
      getAllChannels(),
      getLatestPosts(),
      getHotPosts(),
      getActiveCreators(),
      getPopularTags(),
    ]);

  const signedIn = session !== null;

  return (
    <div className="flex flex-1 flex-col">
      <CommunityHero signedIn={signedIn} />

      <ChannelCategoryBar active={activeCategory} />

      <div className="flex gap-6 px-4 py-6 sm:px-8">
        {/* Left main content — 70% */}
        <div className="min-w-0 flex-1 space-y-8">
          <ChannelGrid channels={allChannels} />
          <PopularChannelGrid channels={channels} />
          <LatestPostList posts={latestPosts} signedIn={signedIn} />
          <HotPostList posts={hotPosts} />
        </div>

        {/* Right sidebar — 30% */}
        <aside className="hidden w-72 shrink-0 space-y-4 xl:block">
          <CommunityStatsCard
            channelCount={stats.channelCount}
            postCount={stats.postCount}
            creatorCount={stats.creatorCount}
            todayPostCount={stats.todayPostCount}
          />
          <PublishGuideCard signedIn={signedIn} />
          <HotChannelList channels={channels} />
          <SidebarCreators creators={creators} />
          <SidebarTags tags={tags} />
          <BeginnerGuide />
        </aside>
      </div>

      <QuickPublishButton />
    </div>
  );
}
