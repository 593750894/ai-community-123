import Link from "next/link";
import {
  ArrowUpRight,
  CalendarClock,
  Crown,
  Flame,
  Sparkles,
  TrendingUp,
  Trophy,
} from "lucide-react";

const HOT_CREATORS = [
  { name: "陈卷卷", handle: "@juanjuan", works: 124, fans: "23.4k", color: "from-amber-300 to-orange-500" },
  { name: "MidnightAI", handle: "@midnight", works: 87, fans: "18.1k", color: "from-cyan-300 to-blue-500" },
  { name: "Pixel·林", handle: "@pixel_lin", works: 56, fans: "12.7k", color: "from-fuchsia-300 to-purple-500" },
  { name: "落日工作室", handle: "@sunset_studio", works: 41, fans: "9.2k", color: "from-rose-300 to-red-500" },
];

const TRENDING_TAGS = [
  { tag: "Seedance 2.0 首发体验", heat: "12.4w" },
  { tag: "1080P 真实人像测试", heat: "6.8w" },
  { tag: "首尾帧补间挑战赛", heat: "4.1w" },
  { tag: "AI 短剧分镜方法论", heat: "3.6w" },
  { tag: "Veo3 vs Seedance", heat: "2.9w" },
  { tag: "ComfyUI × 视频后期", heat: "1.7w" },
];

const EVENTS = [
  {
    title: "Seedance 创作挑战赛 · 第 3 期",
    desc: "主题：未来都市 24h，奖池 ¥80,000",
    date: "06.01 - 06.15",
    tag: "进行中",
    tone: "bg-emerald-500/15 text-emerald-300",
  },
  {
    title: "AI 短剧编剧训练营",
    desc: "8 节直播 · 全球 Top 导演授课",
    date: "06.08 起",
    tag: "招募中",
    tone: "bg-cyan-500/15 text-cyan-300",
  },
  {
    title: "SeedLand 月度 Showcase",
    desc: "投稿截止 6 月 25 日 24:00",
    date: "06.30 颁奖",
    tag: "投稿",
    tone: "bg-amber-500/15 text-amber-300",
  },
];

export function RightPanel() {
  return (
    <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-80 shrink-0 overflow-y-auto border-l border-border/60 bg-background/40 px-4 py-5 xl:block">
      <Section icon={Flame} title="本周热议">
        <ul className="space-y-2">
          {TRENDING_TAGS.map((t, idx) => (
            <li key={t.tag}>
              <Link
                href={`/t/${encodeURIComponent(t.tag)}`}
                className="group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50"
              >
                <span
                  className={`w-5 text-center text-xs font-semibold tabular-nums ${
                    idx < 3 ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {idx + 1}
                </span>
                <span className="flex-1 truncate text-sm text-foreground/90 group-hover:text-foreground">
                  {t.tag}
                </span>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {t.heat}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section icon={Crown} title="活跃创作者" action={{ label: "排行榜", href: "/community/leaderboard" }}>
        <ul className="space-y-2">
          {HOT_CREATORS.map((c, idx) => (
            <li key={c.handle}>
              <Link
                href={`/u/${c.handle.replace("@", "")}`}
                className="flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50"
              >
                <div className="relative">
                  <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${c.color} text-sm font-semibold text-black/70`}
                  >
                    {c.name.slice(0, 1)}
                  </span>
                  {idx === 0 && (
                    <Trophy className="absolute -right-1 -top-1 size-3.5 text-amber-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{c.name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {c.fans} 关注 · {c.works} 作品
                  </div>
                </div>
                <button className="rounded-md border border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary">
                  关注
                </button>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section icon={CalendarClock} title="官方活动">
        <ul className="space-y-2">
          {EVENTS.map((e) => (
            <li
              key={e.title}
              className="group rounded-lg border border-border/60 bg-card/40 p-3 transition-colors hover:border-primary/40 hover:bg-card/70"
            >
              <div className="mb-1 flex items-center gap-2">
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${e.tone}`}>
                  {e.tag}
                </span>
                <span className="text-[10px] text-muted-foreground">{e.date}</span>
              </div>
              <div className="text-sm font-medium text-foreground/90 group-hover:text-foreground">
                {e.title}
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">{e.desc}</div>
            </li>
          ))}
        </ul>
      </Section>

      <div className="mt-6 rounded-lg border border-border/60 bg-gradient-to-br from-primary/10 via-card/40 to-card/40 p-4">
        <div className="mb-2 flex items-center gap-2 text-xs text-primary">
          <Sparkles className="size-3.5" />
          创作者计划
        </div>
        <div className="text-sm font-medium">分成 + 流量扶持</div>
        <div className="mt-1 text-[11px] text-muted-foreground">
          注册成为认证创作者，享受官方分成与首页推荐位曝光。
        </div>
        <Link
          href="/community/creator-program"
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
        >
          了解详情 <ArrowUpRight className="size-3" />
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap gap-x-3 gap-y-1 px-1 text-[11px] text-muted-foreground/70">
        <Link href="/about" className="hover:text-foreground">关于</Link>
        <Link href="/community/rules" className="hover:text-foreground">社区公约</Link>
        <Link href="/legal/terms" className="hover:text-foreground">服务条款</Link>
        <Link href="/legal/privacy" className="hover:text-foreground">隐私政策</Link>
        <Link href="/contact" className="hover:text-foreground">联系我们</Link>
        <span>© 2026 SeedLand</span>
      </div>
    </aside>
  );
}

function Section({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  action?: { label: string; href: string };
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5">
      <div className="mb-2 flex items-center justify-between px-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-foreground/90">
          <Icon className="size-3.5 text-primary" />
          {title}
        </div>
        {action && (
          <Link
            href={action.href}
            className="flex items-center gap-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            {action.label}
            <TrendingUp className="size-3" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
