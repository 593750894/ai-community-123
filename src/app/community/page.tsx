import { CommunityHero } from "@/components/community/community-hero";
import { ChannelCategoryBar } from "@/components/community/channel-category-bar";
import { PopularChannelGrid } from "@/components/community/popular-channel-grid";
import { LatestDiscussionList } from "@/components/community/latest-discussion-list";
import { HotPostList } from "@/components/community/hot-post-list";
import { CommunityStatsCard } from "@/components/community/community-stats-card";
import { SidebarCreators } from "@/components/community/sidebar-creators";
import { SidebarTags } from "@/components/community/sidebar-tags";
import { BeginnerGuide } from "@/components/community/beginner-guide";
import { QuickPublishButton } from "@/components/community/quick-publish-button";
import {
  getCommunityStats,
  getHotChannels,
  getLatestPosts,
  getHotPosts,
  getActiveCreators,
  getPopularTags,
} from "@/lib/community/queries";

export const dynamic = "force-dynamic";

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const activeCategory = category ?? "all";

  const [stats, channels, latestPosts, hotPosts, creators, tags] =
    await Promise.all([
      getCommunityStats(),
      getHotChannels(),
      getLatestPosts(),
      getHotPosts(),
      getActiveCreators(),
      getPopularTags(),
    ]);

  return (
    <div className="flex flex-1 flex-col">
      <CommunityHero />

      <ChannelCategoryBar active={activeCategory} />

      <div className="flex gap-6 px-4 py-6 sm:px-8">
        {/* Left main content — 70% */}
        <div className="min-w-0 flex-1 space-y-8">
          <PopularChannelGrid channels={channels} />
          <LatestDiscussionList posts={latestPosts} />
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
          <SidebarCreators creators={creators} />
          <SidebarTags tags={tags} />
          <BeginnerGuide />
        </aside>
      </div>

      <QuickPublishButton />
    </div>
  );
}
