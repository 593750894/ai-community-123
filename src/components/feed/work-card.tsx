import Link from "next/link";
import { Play, Sparkles, Wrench } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  workCategoryMeta,
  type WorkCategoryValue,
} from "@/lib/work-categories";
import {
  BookmarkButton,
  LikeButton,
} from "@/components/feed/interaction-buttons";
import { ReportButton } from "@/components/reports/report-button";
import {
  OrgAttributionBadge,
  type OrgAttribution,
} from "@/components/publish/org-attribution-badge";

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
  organization?: OrgAttribution | null;
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
  viewerId = null,
}: {
  work: Work;
  signedIn?: boolean;
  liked?: boolean;
  bookmarked?: boolean;
  viewerId?: string | null;
}) {
  const ratio = work.ratio ?? "16:9";
  const aspect =
    ratio === "9:16"
      ? "aspect-[9/16]"
      : ratio === "1:1"
        ? "aspect-square"
        : "aspect-video";
  const meta = work.category ? workCategoryMeta(work.category) : null;
  const likeCount =
    typeof work.likeCount === "number"
      ? work.likeCount
      : typeof work.likes === "number"
        ? work.likes
        : 0;
  const bookmarkCount = work.bookmarkCount ?? 0;
  return (
    <div className="group surface-card relative overflow-hidden border border-border transition-all hover:-translate-y-0.5 hover:border-primary/50">
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
          <div className="absolute inset-0 bg-muted" />
        )}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />

        {/* 类型 badge —— 突出作品广场属性 */}
        {meta && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full border border-border bg-card/80 px-2 py-0.5 text-[10px] font-semibold text-foreground/90">
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

        <span className="absolute right-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white">
          {formatDuration(work.durationSec, work.duration)}
        </span>

        <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
          <span className="flex size-14 items-center justify-center rounded-full border border-border bg-background/85 text-foreground">
            <Play className="size-6 fill-current" />
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
          <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
            {work.author.slice(0, 1)}
          </span>
          <span className="truncate">{work.author}</span>
          {work.model && !work.tools?.length && (
            <>
              <span className="text-muted-foreground/50">·</span>
              <span className="truncate text-primary/80">{work.model}</span>
            </>
          )}
          {work.organization && <OrgAttributionBadge org={work.organization} size="xs" />}
        </div>

        {work.tools && work.tools.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <Wrench className="size-2.5 text-muted-foreground/70" />
            {work.tools.slice(0, 3).map((t) => (
              <span
                key={t}
                className="rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground"
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

        <div className="flex items-center justify-between gap-1 border-t border-border pt-2 text-[11px] text-muted-foreground tabular-nums">
          <LikeButton
            target={{ kind: "work", id: work.id }}
            initialActive={liked}
            initialCount={likeCount}
            signedIn={signedIn}
          />
          <div className="ml-auto flex items-center gap-1">
            <BookmarkButton
              target={{ kind: "work", id: work.id }}
              initialActive={bookmarked}
              initialCount={bookmarkCount}
              signedIn={signedIn}
              showCount
            />
            {work.authorId && (
              <ReportButton
                targetType="WORK"
                targetId={work.id}
                ownerId={work.authorId}
                viewerId={viewerId}
                variant="icon"
                loginNext={`/showcase/${work.id}`}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

