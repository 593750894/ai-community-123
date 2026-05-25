import { CommunityHero } from "@/components/community/community-hero";
import { ChannelCategoryBar } from "@/components/community/channel-category-bar";
import { PopularChannelGrid } from "@/components/community/popular-channel-grid";
import { LatestDiscussionList } from "@/components/community/latest-discussion-list";
import { HotPostList } from "@/components/community/hot-post-list";
import { ActiveCreatorList } from "@/components/community/active-creator-list";
import { TagCloud } from "@/components/community/tag-cloud";
import { QuickPublishButton } from "@/components/community/quick-publish-button";
import {
  getCommunityStats,
  getPopularChannels,
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
      getPopularChannels(),
      getLatestPosts(),
      getHotPosts(),
      getActiveCreators(),
      getPopularTags(),
    ]);

  return (
    <div className="flex flex-1 flex-col">
      <CommunityHero
        channelCount={stats.channelCount}
        postCount={stats.postCount}
        creatorCount={stats.creatorCount}
        todayPostCount={stats.todayPostCount}
      />

      <ChannelCategoryBar active={activeCategory} />

      <div className="space-y-8 px-4 py-6 sm:px-8">
        <PopularChannelGrid channels={channels} />
        <LatestDiscussionList posts={latestPosts} />
        <HotPostList posts={hotPosts} />
        <ActiveCreatorList creators={creators} />
        <TagCloud tags={tags} />
      </div>

      <QuickPublishButton />
    </div>
  );
}
