import {
  CalendarPlus,
  Hash,
  MessageSquare,
  TrendingUp,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type StatItem = {
  icon: LucideIcon;
  label: string;
  value: number;
  color: string;
};

export function CommunityStatsCard({
  channelCount,
  postCount,
  creatorCount,
  todayPostCount,
}: {
  channelCount: number;
  postCount: number;
  creatorCount: number;
  todayPostCount: number;
}) {
  const stats: StatItem[] = [
    { icon: Hash, label: "频道", value: channelCount, color: "text-violet-400" },
    { icon: MessageSquare, label: "帖子", value: postCount, color: "text-cyan-400" },
    { icon: Users, label: "创作者", value: creatorCount, color: "text-emerald-400" },
    { icon: CalendarPlus, label: "今日新帖", value: todayPostCount, color: "text-amber-400" },
  ];

  return (
    <section className="surface-card p-4">
      <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-foreground/90">
        <TrendingUp className="size-3.5 text-primary" />
        社区数据
      </div>
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-border/40 bg-card/30 px-3 py-2.5 text-center"
          >
            <div className="flex items-center justify-center gap-1.5">
              <s.icon className={`size-3.5 ${s.color}`} />
              <span className="text-lg font-bold tabular-nums text-foreground">
                {s.value}
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground">{s.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
