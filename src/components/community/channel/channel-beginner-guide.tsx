import Link from "next/link";
import {
  BookOpen,
  Compass,
  MessageCircle,
  ArrowUpRight,
} from "lucide-react";

export function ChannelBeginnerGuide({ channelId }: { channelId: string }) {
  const guides = [
    {
      icon: BookOpen,
      label: "社区公约",
      href: "/community/rules",
      color: "text-cyan-400",
    },
    {
      icon: MessageCircle,
      label: "发帖指南",
      href: `/create-post?channelId=${channelId}`,
      color: "text-emerald-400",
    },
    {
      icon: Compass,
      label: "浏览全部频道",
      href: "/community",
      color: "text-violet-400",
    },
  ];

  return (
    <section className="surface-card overflow-hidden">
      <div className="border-b border-border/30 bg-gradient-to-r from-primary/8 via-transparent to-transparent px-4 py-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/90">
          <Compass className="size-3.5 text-primary" />
          新手提示
        </div>
      </div>
      <p className="px-4 py-3 text-xs leading-relaxed text-muted-foreground/80">
        第一次来这个频道？可以先分享你正在使用的 AI 视频工具、遇到的问题或最近完成的作品。
      </p>
      <div className="border-t border-border/25 p-2">
        {guides.map((g) => (
          <Link
            key={g.href}
            href={g.href}
            className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all hover:bg-muted/40"
          >
            <g.icon className={`size-4 ${g.color} transition-transform group-hover:scale-110`} />
            <span className="flex-1 text-sm text-foreground/90 transition-colors group-hover:text-foreground">
              {g.label}
            </span>
            <ArrowUpRight className="size-3.5 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
          </Link>
        ))}
      </div>
    </section>
  );
}
