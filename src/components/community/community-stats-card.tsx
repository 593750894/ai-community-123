import {
  CalendarPlus,
  Hash,
  MessageSquare,
  TrendingUp,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { InlineError } from "@/components/ui/error-state";

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
  error = false,
}: {
  channelCount: number;
  postCount: number;
  creatorCount: number;
  todayPostCount: number;
  error?: boolean;
}) {
  const stats: StatItem[] = [
    { icon: Hash, label: "频道", value: channelCount, color: "text-violet-400" },
    { icon: MessageSquare, label: "帖子", value: postCount, color: "text-cyan-400" },
    { icon: Users, label: "创作者", value: creatorCount, color: "text-emerald-400" },
    { icon: CalendarPlus, label: "今日新帖", value: todayPostCount, color: "text-amber-400" },
  ];

  return (
    <section className="surface-card p-4">
      <div className="mb-3.5 flex items-center gap-1.5 text-xs font-semibold text-foreground/90">
        <TrendingUp className="size-3.5 text-primary" />
        社区数据
      </div>
      {error ? (
        <InlineError message="统计数据加载失败" />
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {stats.map((s) => (
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
              <span className="mt-0.5 block text-[11px] text-muted-foreground">{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
