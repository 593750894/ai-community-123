import Link from "next/link";
import { Play, Sparkles, Wrench } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  authorTintFromName,
  workCategoryMeta,
  type WorkCategoryValue,
} from "@/lib/work-categories";
import {
  BookmarkButton,
  LikeButton,
} from "@/components/feed/interaction-buttons";

// 兼容旧 demo 字段（页面上仍有 mock 占位），同时支持新的 DB 字段。
export type Work = {
  id: string;
  title: string;
  // 旧 mock：cover 是 tailwind gradient class；新 DB：thumbnailUrl 是图片 URL
  cover?: string;
  thumbnailUrl?: string | null;
  // 新 DB：作品分类 + 简介 + 使用工具
  category?: WorkCategoryValue;
  description?: string | null;
  tools?: string[];
  // 计数（数字优先，字符串兼容旧 demo）
  likes?: number | string;
  likeCount?: number;
  bookmarkCount?: number;
  comments?: number | string;
  // 时长展示（mock 用 "00:18" / 新数据用秒数）
  duration?: string;
  durationSec?: number | null;
  // 作者
  author: string;
  authorTint?: string;
  authorId?: string;
  // 兼容字段：旧 mock 上的 "Seedance 2.0" 模型字符串
  model?: string;
  tag?: string;
  ratio?: "16:9" | "9:16" | "1:1";
};

function formatDuration(sec?: number | null, fallback?: string): string {
  if (typeof sec === "number" && sec > 0) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return fallback ?? "—";
}

export function WorkCard({
  work,
  signedIn = false,
  liked = false,
  bookmarked = false,
}: {
  work: Work;
  signedIn?: boolean;
  liked?: boolean;
  bookmarked?: boolean;
}) {
  const ratio = work.ratio ?? "16:9";
  const aspect =
    ratio === "9:16"
      ? "aspect-[9/16]"
      : ratio === "1:1"
        ? "aspect-square"
        : "aspect-video";
  const meta = work.category ? workCategoryMeta(work.category) : null;
  const coverGradient = work.cover ?? meta?.cover ?? "from-slate-700/60 via-slate-800/60 to-slate-950/80";
  const tint = work.authorTint ?? authorTintFromName(work.author);
  const likeCount =
    typeof work.likeCount === "number"
      ? work.likeCount
      : typeof work.likes === "number"
        ? work.likes
        : 0;
  const bookmarkCount = work.bookmarkCount ?? 0;
  return (
    <div className="group surface-glass relative overflow-hidden border-primary/20 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-[0_12px_40px_-12px_rgba(56,189,248,0.45)]">
      {/* 卡片视觉与普通帖子区分：双层光晕 + 顶部强渐变 + 角标 */}
      <Link
        href={`/showcase/${work.id}`}
        aria-label={work.title}
        className={cn("relative block w-full overflow-hidden", aspect)}
      >
        {work.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={work.thumbnailUrl}
            alt={work.title}
            className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className={cn("absolute inset-0 bg-gradient-to-br", coverGradient)} />
        )}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_60%)]" />
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />

        {/* 类型 badge —— 突出作品广场属性 */}
        {meta && (
          <span
            className={cn(
              "absolute left-2 top-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold backdrop-blur",
              meta.tone,
            )}
          >
            <Sparkles className="size-2.5" />
            {meta.label}
          </span>
        )}
        {work.tag && !meta && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-primary/85 px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
            <Sparkles className="size-2.5" />
            {work.tag}
          </span>
        )}

        <span className="absolute right-2 top-2 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white backdrop-blur">
          {formatDuration(work.durationSec, work.duration)}
        </span>

        <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
          <span className="flex size-14 items-center justify-center rounded-full bg-white/15 backdrop-blur-md ring-1 ring-white/30">
            <Play className="size-6 fill-white text-white" />
          </span>
        </span>
      </Link>

      <div className="space-y-2 p-3">
        <Link
          href={`/showcase/${work.id}`}
          className="line-clamp-2 block text-sm font-medium leading-snug text-foreground/95 hover:text-primary"
        >
          {work.title}
        </Link>

        {work.description && (
          <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
            {work.description}
          </p>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span
            className={cn(
              "flex size-5 items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-semibold text-black/70",
              tint,
            )}
          >
            {work.author.slice(0, 1)}
          </span>
          <span className="truncate">{work.author}</span>
          {work.model && !work.tools?.length && (
            <>
              <span className="text-muted-foreground/50">·</span>
              <span className="truncate text-primary/80">{work.model}</span>
            </>
          )}
        </div>

        {work.tools && work.tools.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <Wrench className="size-2.5 text-muted-foreground/70" />
            {work.tools.slice(0, 3).map((t) => (
              <span
                key={t}
                className="rounded-md border border-border/50 bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                {t}
              </span>
            ))}
            {work.tools.length > 3 && (
              <span className="text-[10px] text-muted-foreground/70">
                +{work.tools.length - 3}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-border/30 pt-2 text-[11px] text-muted-foreground tabular-nums">
          <LikeButton
            target={{ kind: "work", id: work.id }}
            initialActive={liked}
            initialCount={likeCount}
            signedIn={signedIn}
          />
          <BookmarkButton
            target={{ kind: "work", id: work.id }}
            initialActive={bookmarked}
            initialCount={bookmarkCount}
            signedIn={signedIn}
            showCount
          />
        </div>
      </div>
    </div>
  );
}

export const DEMO_WORKS: Work[] = [
  {
    id: "w001",
    title: "未来都市 24h — Seedance 2.0 1080P 实拍级测试",
    cover: "from-cyan-500/70 via-blue-700/60 to-violet-900/80",
    duration: "00:18",
    author: "MidnightAI",
    authorTint: "from-cyan-300 to-blue-500",
    model: "Seedance 2.0",
    likes: "12.4k",
    comments: 268,
    tag: "本周精选",
  },
  {
    id: "w002",
    title: "AI 短剧《潮汐》第 3 集 · 雨夜对话长镜头",
    cover: "from-amber-400/60 via-rose-700/60 to-indigo-900/80",
    duration: "01:42",
    author: "陈卷卷",
    authorTint: "from-amber-300 to-orange-500",
    model: "Seedance 2.0 + Kling",
    likes: "8.7k",
    comments: 412,
  },
  {
    id: "w003",
    title: "数字人 Lina · 弹琴 30s 连续动作",
    cover: "from-fuchsia-500/60 via-purple-700/60 to-slate-900/80",
    duration: "00:30",
    author: "Pixel·林",
    authorTint: "from-fuchsia-300 to-purple-500",
    model: "Seedance + 自训练 LoRA",
    likes: "6.1k",
    comments: 198,
    tag: "数字人",
  },
  {
    id: "w004",
    title: "首尾帧补间挑战 · 从黎明到落日",
    cover: "from-orange-400/70 via-rose-600/60 to-slate-900/80",
    duration: "00:24",
    author: "落日工作室",
    authorTint: "from-rose-300 to-red-500",
    model: "Seedance 2.0",
    likes: "5.3k",
    comments: 156,
  },
  {
    id: "w005",
    title: "实验：纯文本驱动 · 工业风产品广告",
    cover: "from-slate-400/60 via-zinc-700/60 to-slate-950/90",
    duration: "00:12",
    author: "Cube Studio",
    authorTint: "from-slate-300 to-zinc-500",
    model: "Seedance 2.0",
    likes: "3.9k",
    comments: 87,
  },
  {
    id: "w006",
    title: "可灵 2.0 vs Seedance · 同 prompt 真实人像对比",
    cover: "from-emerald-400/60 via-teal-700/60 to-blue-900/80",
    duration: "00:48",
    author: "Eval Lab",
    authorTint: "from-emerald-300 to-teal-500",
    model: "对比评测",
    likes: "9.8k",
    comments: 521,
    tag: "评测",
  },
  {
    id: "w007",
    title: "MV 《银河便利店》全片 — 9 镜头连贯叙事",
    cover: "from-indigo-400/60 via-purple-700/60 to-slate-900/80",
    duration: "02:35",
    author: "夜航 Studio",
    authorTint: "from-indigo-300 to-purple-500",
    model: "Seedance + AE",
    likes: "15.2k",
    comments: 730,
  },
  {
    id: "w008",
    title: "ComfyUI × Seedance 工作流分享（完整节点图）",
    cover: "from-blue-400/60 via-cyan-700/60 to-emerald-900/80",
    duration: "教程",
    author: "工作流研究所",
    authorTint: "from-cyan-300 to-emerald-500",
    model: "Tutorial",
    likes: "4.5k",
    comments: 312,
    tag: "教程",
  },
];
