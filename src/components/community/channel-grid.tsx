import type { ChannelOverview } from "@/types/community";
import {
  CHANNEL_CATEGORIES,
  type ChannelCategory,
} from "@/lib/community/channel-categories";
import { ChannelCard } from "./channel-card";

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return `${Math.floor(days / 30)} 月前`;
}

function CategorySection({
  category,
  channelMap,
}: {
  category: ChannelCategory;
  channelMap: Map<string, ChannelOverview>;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground/90">
        {category.label}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {category.channels.map((def) => {
          const dbChannel = channelMap.get(def.slug);
          return (
            <ChannelCard
              key={def.slug}
              slug={dbChannel?.slug ?? def.slug}
              name={dbChannel?.name ?? def.name}
              description={
                dbChannel?.description ?? def.description
              }
              icon={dbChannel?.icon ?? def.icon}
              color={dbChannel?.color ?? def.color}
              postCount={dbChannel?.postCount ?? 0}
              lastActive={
                dbChannel?.latestPost
                  ? formatRelativeTime(dbChannel.latestPost.createdAt)
                  : null
              }
            />
          );
        })}
      </div>
    </div>
  );
}

export function ChannelGrid({
  channels,
}: {
  channels: ChannelOverview[];
}) {
  const channelMap = new Map(channels.map((ch) => [ch.slug, ch]));

  return (
    <section className="space-y-6">
      <h2 className="text-base font-semibold">频道分类</h2>
      {CHANNEL_CATEGORIES.map((cat) => (
        <CategorySection
          key={cat.key}
          category={cat}
          channelMap={channelMap}
        />
      ))}
    </section>
  );
}
