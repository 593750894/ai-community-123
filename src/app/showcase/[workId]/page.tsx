import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Bookmark,
  Clock,
  Eye,
  ExternalLink,
  Heart,
  ImageIcon,
  Play,
  Wrench,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { WorkCard, type Work } from "@/components/feed/work-card";
import {
  BookmarkButton,
  LikeButton,
} from "@/components/feed/interaction-buttons";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { loadInteractionState } from "@/lib/interactions/queries";
import { cn, formatRelativeTime } from "@/lib/utils";
import {
  authorTintFromName,
  workCategoryMeta,
  type WorkCategoryValue,
} from "@/lib/work-categories";

export const dynamic = "force-dynamic";

async function getWork(workId: string) {
  return prisma.work.findUnique({
    where: { id: workId },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          username: true,
          avatar: true,
          bio: true,
          industryRole: true,
        },
      },
    },
  });
}

async function getMoreFromAuthor(authorId: string, excludeId: string) {
  const rows = await prisma.work.findMany({
    where: { authorId, isPublic: true, id: { not: excludeId } },
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { id: true, name: true } },
    },
    take: 4,
  });
  return rows;
}

function formatDuration(sec: number | null | undefined): string {
  if (!sec || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default async function WorkDetailPage({
  params,
}: {
  params: Promise<{ workId: string }>;
}) {
  const { workId } = await params;
  const work = await getWork(workId);
  if (!work) notFound();

  const meta = workCategoryMeta(work.category);
  const tint = authorTintFromName(work.author.name);

  // 计数：曝光 + 1（轻量异步）
  await prisma.work.update({
    where: { id: work.id },
    data: { views: { increment: 1 } },
  });

  const [moreWorks, session] = await Promise.all([
    getMoreFromAuthor(work.authorId, work.id),
    getSession(),
  ]);
  const moreIds = moreWorks.map((w) => w.id);
  const interactions = await loadInteractionState({
    workIds: [work.id, ...moreIds],
  });
  const signedIn = Boolean(session);
  const liked = interactions.likedWorkIds.has(work.id);
  const bookmarked = interactions.bookmarkedWorkIds.has(work.id);
  const aspect =
    work.ratio === "9:16"
      ? "aspect-[9/16] sm:max-w-md sm:mx-auto"
      : work.ratio === "1:1"
        ? "aspect-square sm:max-w-xl sm:mx-auto"
        : "aspect-video";

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        eyebrow={`作品详情 · ${meta.label}`}
        title={work.title}
        description={`由 ${work.author.name} 于 ${formatRelativeTime(work.createdAt)}发布`}
        actions={
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/showcase" />}
          >
            <ArrowLeft className="size-3.5" />
            返回作品广场
          </Button>
        }
      />

      <div className="grid gap-6 px-6 py-6 sm:px-8 lg:grid-cols-[1fr_320px]">
        <main className="space-y-6">
          {/* 视频播放区 */}
          <section className="overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-card/60 to-card/20">
            <div className={cn("relative w-full overflow-hidden bg-black", aspect)}>
              {work.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={work.thumbnailUrl}
                  alt={work.title}
                  className="absolute inset-0 size-full object-cover opacity-90"
                />
              ) : (
                <div className={cn("absolute inset-0 bg-gradient-to-br", meta.cover)} />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <a
                href={work.videoUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="absolute inset-0 flex items-center justify-center"
                title="在新标签页打开原视频链接"
              >
                <span className="flex size-20 items-center justify-center rounded-full bg-white/15 backdrop-blur-md ring-1 ring-white/30 transition-transform hover:scale-105">
                  <Play className="size-9 fill-white text-white" />
                </span>
              </a>
              <div className="absolute right-3 top-3 flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium backdrop-blur",
                    meta.tone,
                  )}
                >
                  {meta.label}
                </span>
                <span className="rounded bg-black/55 px-2 py-0.5 text-[11px] font-medium tabular-nums text-white backdrop-blur">
                  {formatDuration(work.durationSec)}
                </span>
              </div>
            </div>

            <div className="space-y-3 p-5">
              <h1 className="text-xl font-semibold leading-snug sm:text-2xl">
                {work.title}
              </h1>

              {/* 计数条 */}
              <div className="flex flex-wrap items-center gap-3 border-y border-border/40 py-3 text-xs text-muted-foreground tabular-nums">
                <span className="inline-flex items-center gap-1.5">
                  <Eye className="size-3.5" />
                  {work.views} 次观看
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-3.5" />
                  {formatRelativeTime(work.createdAt)}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <LikeButton
                    target={{ kind: "work", id: work.id }}
                    initialActive={liked}
                    initialCount={work.likeCount}
                    signedIn={signedIn}
                    size="md"
                    variant="solid"
                  />
                  <BookmarkButton
                    target={{ kind: "work", id: work.id }}
                    initialActive={bookmarked}
                    initialCount={work.bookmarkCount}
                    signedIn={signedIn}
                    showCount
                    size="md"
                    variant="solid"
                  />
                </div>
              </div>

              {/* 简介 */}
              {work.description && (
                <div className="space-y-1.5">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground/80">
                    简介
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-7 text-foreground/95">
                    {work.description}
                  </p>
                </div>
              )}

              {/* 使用工具 */}
              {work.tools.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground/80">
                    使用工具
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {work.tools.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-xs text-foreground/90"
                      >
                        <Wrench className="size-3 text-muted-foreground/70" />
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* prompt（可选） */}
              {work.prompt && (
                <div className="space-y-1.5">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground/80">
                    Prompt
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2 font-mono text-[11px] leading-relaxed text-foreground/85">
                    {work.prompt}
                  </div>
                </div>
              )}

              {/* 原始链接 */}
              <div className="grid gap-3 sm:grid-cols-2">
                <LinkField
                  label="视频链接"
                  icon={<Play className="size-3" />}
                  href={work.videoUrl}
                  accent="text-primary"
                />
                {work.thumbnailUrl && (
                  <LinkField
                    label="封面链接"
                    icon={<ImageIcon className="size-3" />}
                    href={work.thumbnailUrl}
                    accent="text-cyan-300"
                  />
                )}
              </div>
            </div>
          </section>

          {/* 同作者更多作品 */}
          {moreWorks.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium">
                {work.author.name} 的更多作品
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {moreWorks.map((w) => {
                  const item: Work = {
                    id: w.id,
                    title: w.title,
                    thumbnailUrl: w.thumbnailUrl,
                    category: w.category as WorkCategoryValue,
                    description: w.description,
                    tools: w.tools,
                    likeCount: w.likeCount,
                    bookmarkCount: w.bookmarkCount,
                    durationSec: w.durationSec,
                    ratio: (w.ratio as Work["ratio"]) ?? "16:9",
                    author: w.author.name,
                    authorId: w.author.id,
                  };
                  return (
                    <WorkCard
                      key={w.id}
                      work={item}
                      signedIn={signedIn}
                      liked={interactions.likedWorkIds.has(w.id)}
                      bookmarked={interactions.bookmarkedWorkIds.has(w.id)}
                    />
                  );
                })}
              </div>
            </section>
          )}
        </main>

        <aside className="space-y-4">
          {/* 作品分类卡 */}
          <section className="rounded-2xl border border-border/60 bg-card/40 p-4">
            <div className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground/80">
              作品类型
            </div>
            <div
              className={cn(
                "rounded-lg border bg-gradient-to-br p-3",
                meta.tone,
                meta.cover,
              )}
            >
              <div className="text-sm font-semibold text-foreground">
                {meta.label}
              </div>
              <p className="mt-1 text-xs text-foreground/80">{meta.desc}</p>
            </div>
            <Link
              href={`/showcase?category=${work.category}`}
              className="mt-3 block text-center text-xs text-primary hover:underline"
            >
              浏览全部「{meta.label}」 →
            </Link>
          </section>

          {/* 作者卡 */}
          <section className="rounded-2xl border border-border/60 bg-card/40 p-4">
            <div className="mb-3 text-[11px] uppercase tracking-wide text-muted-foreground/80">
              作者
            </div>
            <div className="flex items-center gap-3">
              {work.author.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={work.author.avatar}
                  alt={work.author.name}
                  className="size-12 rounded-xl border border-border/60"
                />
              ) : (
                <span
                  className={cn(
                    "flex size-12 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-medium text-black/70",
                    tint,
                  )}
                >
                  {work.author.name.slice(0, 1)}
                </span>
              )}
              <div className="min-w-0">
                <Link
                  href={`/profile/${work.author.id}`}
                  className="block truncate text-sm font-medium text-foreground/95 hover:text-primary"
                >
                  {work.author.name}
                </Link>
                <div className="truncate text-xs text-muted-foreground">
                  @{work.author.username}
                </div>
                {work.author.industryRole && (
                  <div className="mt-1 inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                    {work.author.industryRole}
                  </div>
                )}
              </div>
            </div>
            {work.author.bio && (
              <p className="mt-3 line-clamp-3 text-xs text-muted-foreground">
                {work.author.bio}
              </p>
            )}
            <Link
              href={`/profile/${work.author.id}`}
              className="mt-3 block text-center text-xs text-primary hover:underline"
            >
              查看作者主页 →
            </Link>
          </section>

          {/* 互动数据 */}
          <section className="rounded-2xl border border-border/60 bg-card/40 p-4">
            <div className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground/80">
              数据
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat icon={<Eye className="size-3.5" />} value={work.views} label="观看" />
              <Stat icon={<Heart className="size-3.5" />} value={work.likeCount} label="点赞" />
              <Stat icon={<Bookmark className="size-3.5" />} value={work.bookmarkCount} label="收藏" />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function LinkField({
  label,
  icon,
  href,
  accent,
}: {
  label: string;
  icon: React.ReactNode;
  href: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-3">
      <div className={cn("mb-1.5 inline-flex items-center gap-1 text-[11px]", accent)}>
        {icon}
        {label}
      </div>
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex items-center gap-1 truncate text-xs text-primary hover:underline"
      >
        <span className="truncate">{href}</span>
        <ExternalLink className="size-3 shrink-0" />
      </a>
    </div>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-background/30 px-2 py-2">
      <div className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
