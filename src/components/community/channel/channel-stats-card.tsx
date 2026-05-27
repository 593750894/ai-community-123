import {
  CalendarPlus,
  Flame,
  MessageSquare,
  TrendingUp,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { ChannelStats } from "@/types/community";

type StatItem = {
  icon: LucideIcon;
  label: string;
  value: number;
  color: string;
};

export function ChannelStatsCard({ stats }: { stats: ChannelStats }) {
  const items: StatItem[] = [
    { icon: MessageSquare, label: "总帖子", value: stats.postCount, color: "text-cyan-400" },
    { icon: CalendarPlus, label: "今日新帖", value: stats.todayPostCount, color: "text-amber-400" },
    { icon: Users, label: "参与创作者", value: stats.creatorCount, color: "text-emerald-400" },
    { icon: Flame, label: "本周热帖", value: stats.hotPostCount, color: "text-orange-400" },
  ];

  return (
    <section className="surface-card p-4">
      <div className="mb-3.5 flex items-center gap-1.5 text-xs font-semibold text-foreground/90">
        <TrendingUp className="size-3.5 text-primary" />
        频道数据
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {items.map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-border/30 bg-muted/30 px-3 py-3 text-center transition-colors hover:bg-muted/50"
          >
            <div className="flex items-center justify-center gap-1.5">
              <s.icon className={`size-3.5 ${s.color}`} />
              <span className="text-lg font-bold tabular-nums text-foreground">
                {s.value}
              </span>
            </div>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
