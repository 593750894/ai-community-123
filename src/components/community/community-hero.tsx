import Link from "next/link";
import { Hash, PenLine, Lightbulb, Wrench, HelpCircle, Rocket } from "lucide-react";

const QUICK_TOPICS = [
  { label: "发起工作流讨论", icon: Lightbulb, color: "text-amber-400" },
  { label: "发布工具体验", icon: Wrench, color: "text-cyan-400" },
  { label: "提问求助", icon: HelpCircle, color: "text-blue-400" },
  { label: "分享项目进展", icon: Rocket, color: "text-emerald-400" },
] as const;

function publishHref(signedIn: boolean) {
  return signedIn ? "/create-post" : "/auth/login?next=/create-post";
}

export function CommunityHero({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <section className="relative overflow-hidden border-b border-border/40 px-6 py-10 sm:px-8 sm:py-12">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-fuchsia-500/6" />
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div className="absolute -top-24 left-1/2 size-96 -translate-x-1/2 rounded-full bg-primary/8 blur-3xl" />

      <div className="relative space-y-5">
        <div className="space-y-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
            <span className="size-1.5 rounded-full bg-primary shadow-[0_0_8px_currentColor]" />
            社区总览
          </span>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            AI 视频创作者社区
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            和同行交流 Seedance、Kling、ComfyUI、数字人、短剧、漫剧与商业项目经验。
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href={publishHref(signedIn)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm shadow-primary/25 transition-colors hover:bg-primary/90"
          >
            <PenLine className="size-4" />
            发起讨论
          </Link>
          <Link
            href="/community"
            className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-card/50 px-4 py-2 text-sm font-medium text-foreground/90 transition-colors hover:border-primary/30 hover:bg-card/80"
          >
            <Hash className="size-4" />
            浏览频道
          </Link>
        </div>

        <div className="flex flex-wrap gap-2">
          {QUICK_TOPICS.map((t) => (
            <Link
              key={t.label}
              href={publishHref(signedIn)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-card/30 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-card/60 hover:text-foreground"
            >
              <t.icon className={`size-3 ${t.color}`} />
              {t.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
