import Link from "next/link";
import {
  ArrowRight,
  Compass,
  Flame,
  Handshake,
  Sparkles,
  Wand2,
  Wrench,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DEMO_WORKS, WorkCard } from "@/components/feed/work-card";

const FEED_TABS = [
  { label: "推荐", active: true },
  { label: "关注" },
  { label: "最新" },
  { label: "Seedance 2.0" },
  { label: "短剧" },
  { label: "数字人" },
  { label: "教程" },
  { label: "评测" },
];

const QUICK_ENTRIES = [
  {
    href: "/create-work",
    icon: Wand2,
    title: "发布我的新作品",
    desc: "上传成片 + 简介 + 使用工具",
    tone: "from-cyan-500/20 to-blue-500/10 border-cyan-500/30",
  },
  {
    href: "/community",
    icon: Compass,
    title: "进入社区",
    desc: "教程 / 工作流 / 行业讨论",
    tone: "from-fuchsia-500/20 to-purple-500/10 border-fuchsia-500/30",
  },
  {
    href: "/collaboration",
    icon: Handshake,
    title: "找伙伴 / 接项目",
    desc: "导演、编剧、合成师、配音正在招募",
    tone: "from-amber-500/20 to-rose-500/10 border-amber-500/30",
  },
  {
    href: "/tools",
    icon: Wrench,
    title: "工具库导航",
    desc: "Seedance · Kling · ComfyUI · Suno",
    tone: "from-emerald-500/20 to-teal-500/10 border-emerald-500/30",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <section className="relative isolate overflow-hidden border-b border-border/60 px-4 py-8 sm:px-8 sm:py-10">
        <div className="absolute inset-0 -z-10 bg-grid opacity-40 [mask-image:radial-gradient(ellipse_at_top,black,transparent_75%)]" />
        <div className="absolute inset-x-0 -top-20 -z-10 mx-auto h-72 max-w-3xl rounded-full bg-primary/20 blur-3xl" />

        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <Badge variant="primary" size="lg">
              <Flame className="size-3" />
              AI 视频创作者社区
            </Badge>
            <h1 className="max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              <span className="text-gradient-brand">
                看作品
              </span>
              ·
              <span className="text-gradient-brand">
                聊工作流
              </span>
              <br className="hidden sm:block" />
              <span>组团队</span> · <span>接项目</span>
            </h1>
            <p className="max-w-xl text-sm text-muted-foreground sm:text-base">
              围绕 Seedance 2.0 与主流视频大模型，连接导演、动画师、特效师与创作团队。一站式作品广场、社区论坛、项目合作、工具库与模型评测。
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="lg"
              nativeButton={false}
              render={<Link href="/create-work" />}
            >
              <Wand2 className="size-4" />
              发布作品
              <ArrowRight className="size-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              nativeButton={false}
              render={<Link href="/showcase" />}
            >
              <Sparkles className="size-4" />
              浏览广场
            </Button>
          </div>
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_ENTRIES.map(({ href, icon: Icon, title, desc, tone }) => (
            <Link
              key={href}
              href={href}
              className={`group relative overflow-hidden rounded-xl border bg-gradient-to-br ${tone} p-4 transition-all hover:-translate-y-0.5`}
            >
              <Icon className="mb-3 size-5 text-foreground/90" />
              <div className="text-sm font-medium">{title}</div>
              <div className="mt-1 text-xs text-muted-foreground">{desc}</div>
              <ArrowRight className="absolute right-3 top-3 size-4 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
            </Link>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4 px-4 py-6 sm:px-8">
        <div className="sticky top-14 z-20 -mx-4 flex items-center gap-1 overflow-x-auto border-b border-border/40 bg-background/85 px-4 py-2 backdrop-blur scroll-x-snap sm:-mx-8 sm:px-8">
          {FEED_TABS.map((t) => (
            <button
              key={t.label}
              className={`shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors ${
                t.active
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3 2xl:grid-cols-4">
          {DEMO_WORKS.map((w) => (
            <WorkCard key={w.id} work={w} />
          ))}
        </div>

        <div className="mt-2 flex justify-center">
          <Button
            variant="outline"
            size="lg"
            nativeButton={false}
            render={<Link href="/showcase" />}
          >
            浏览全部作品
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </section>
    </div>
  );
}
