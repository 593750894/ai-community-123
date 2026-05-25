import { CalendarPlus, Hash, MessageSquare, Users } from "lucide-react";

export function CommunityHero({
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
  const stats = [
    { icon: Hash, label: "频道", value: channelCount },
    { icon: MessageSquare, label: "帖子", value: postCount },
    { icon: Users, label: "创作者", value: creatorCount },
    { icon: CalendarPlus, label: "今日新帖", value: todayPostCount },
  ];

  return (
    <section className="relative overflow-hidden border-b border-border/60 px-6 py-8 sm:px-8 sm:py-10">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-fuchsia-500/5" />

      <div className="relative space-y-4">
        <div className="space-y-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
            <span className="size-1.5 rounded-full bg-primary shadow-[0_0_8px_currentColor]" />
            社区总览
          </span>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            AI 视频创作者社区
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            发现热门频道、参与讨论、结识优秀创作者。这是属于 AI 视频创作者的交流空间。
          </p>
        </div>

        <div className="flex flex-wrap gap-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-2 rounded-lg border border-border/40 bg-card/50 px-3 py-2"
            >
              <s.icon className="size-4 text-muted-foreground" />
              <span className="text-lg font-semibold tabular-nums">
                {s.value}
              </span>
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
