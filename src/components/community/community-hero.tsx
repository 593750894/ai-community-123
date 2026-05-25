import Link from "next/link";
import { Hash, MessageSquare, PenLine, Users } from "lucide-react";

export function CommunityHero() {
  return (
    <section className="relative overflow-hidden border-b border-border/60 px-6 py-10 sm:px-8 sm:py-14">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-fuchsia-500/5" />
      <div className="absolute inset-0 bg-grid opacity-40" />

      <div className="relative space-y-5">
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
            <span className="size-1.5 rounded-full bg-primary shadow-[0_0_8px_currentColor]" />
            社区总览
          </span>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            AI 视频创作者社区
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            交流工具、分享作品、讨论工作流、寻找团队与项目机会
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/create-post"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <PenLine className="size-4" />
            发布讨论
          </Link>
          <Link
            href="/community"
            className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-card/50 px-4 py-2 text-sm font-medium text-foreground/90 transition-colors hover:bg-card/80"
          >
            <Hash className="size-4" />
            浏览频道
          </Link>
        </div>
      </div>
    </section>
  );
}
