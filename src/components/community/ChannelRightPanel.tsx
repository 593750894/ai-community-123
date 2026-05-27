import type { ChannelStats, ChannelOverview, PostOverview } from "@/types/community";
import { ChannelStatsCard } from "@/components/community/channel/channel-stats-card";
import { ChannelHotPosts } from "@/components/community/channel/channel-hot-posts";
import { RelatedChannels } from "@/components/community/channel/related-channels";
import { ChannelBeginnerGuide } from "@/components/community/channel/channel-beginner-guide";

interface ChannelRightPanelProps {
  stats: ChannelStats;
  hotPosts: PostOverview[];
  relatedChannels: ChannelOverview[];
  channelId: string;
}

export function ChannelRightPanel({
  stats,
  hotPosts,
  relatedChannels,
  channelId,
}: ChannelRightPanelProps) {
  return (
    <aside className="w-full shrink-0 space-y-5 xl:w-80">
      <ChannelStatsCard stats={stats} />
      <ChannelHotPosts posts={hotPosts} />
      {relatedChannels.length > 0 && (
        <RelatedChannels channels={relatedChannels} />
      )}
      <ChannelBeginnerGuide channelId={channelId} />
    </aside>
  );
}
