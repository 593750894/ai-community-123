import Link from "next/link";
import { Filter, Flame, Sparkles, Upload, Video } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChip } from "@/components/ui/filter-chip";
import { WorkCard, type Work } from "@/components/feed/work-card";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { loadInteractionState } from "@/lib/interactions/queries";
import {
  WORK_CATEGORY_ORDER,
  workCategoryMeta,
  type WorkCategoryValue,
} from "@/lib/work-categories";
import type { WorkCategory } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ category?: string }>;

async function getWorks(category?: WorkCategoryValue) {
  return prisma.work.findMany({
    where: {
      isPublic: true,
      ...(category ? { category: category as WorkCategory } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      author: {
        select: { id: true, name: true, username: true, avatar: true },
      },
    },
    take: 60,
  });
}

async function getCategoryCounts(): Promise<Record<string, number>> {
  const rows = await prisma.work.groupBy({
    by: ["category"],
    where: { isPublic: true },
    _count: { _all: true },
  });
  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.category] = row._count._all;
  }
  return result;
}

export default async function ShowcasePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { category } = await searchParams;
  const activeCategory =
    category && (WORK_CATEGORY_ORDER as string[]).includes(category)
      ? (category as WorkCategoryValue)
      : null;

  const [works, counts, session] = await Promise.all([
    getWorks(activeCategory ?? undefined),
    getCategoryCounts(),
    getSession(),
  ]);

  const interactions = await loadInteractionState({
    workIds: works.map((w) => w.id),
  });
  const signedIn = Boolean(session);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const items: Work[] = works.map((w) => ({
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
  }));

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        eyebrow="作品广场"
        title="Showcase · AI 视频作品展示"
        description="社区全部公开的 AI 视频作品，按发布时间排序。点击卡片进入详情页可看完整简介、使用工具、原始视频。"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/community" />}
            >
              <Sparkles className="size-3.5" />
              社区论坛
            </Button>
            <Button
              size="sm"
              nativeButton={false}
              render={<Link href="/create-work" />}
            >
              <Upload className="size-3.5" />
              发布作品
            </Button>
          </>
        }
      />

      <div className="space-y-5 px-4 py-5 sm:px-8 sm:py-6">
        <section className="surface-card p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <Filter className="size-3.5" />
            作品分类
            <span className="text-muted-foreground/60">
              · 共 {total} 个公开作品
            </span>
          </div>
          <div className="-mx-1 flex flex-nowrap gap-2 overflow-x-auto px-1 scroll-x-snap sm:flex-wrap sm:overflow-visible">
            <FilterChip
              href="/showcase"
              active={!activeCategory}
              label="全部"
              count={total}
              tone="bg-primary/15 text-primary border-primary/30"
            />
            {WORK_CATEGORY_ORDER.map((c) => {
              const meta = workCategoryMeta(c);
              return (
                <FilterChip
                  key={c}
                  href={`/showcase?category=${c}`}
                  active={activeCategory === c}
                  label={meta.label}
                  count={counts[c] ?? 0}
                  tone={meta.tone}
                />
              );
            })}
          </div>
        </section>

        <section className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Flame className="size-4 text-primary" />
            {activeCategory ? (
              <>
                筛选：
                <span className="font-medium text-foreground">
                  {workCategoryMeta(activeCategory).label}
                </span>
                <span className="text-muted-foreground/60">
                  · {items.length} 个作品
                </span>
              </>
            ) : (
              <>
                按发布时间倒序 ·{" "}
                <span className="font-medium text-foreground">
                  {items.length}
                </span>{" "}
                个最新作品
              </>
            )}
          </div>
        </section>

        {items.length === 0 ? (
          <EmptyState
            icon={Video}
            title={
              activeCategory ? "该分类下还没有作品" : "作品广场还没有任何作品"
            }
            description={
              activeCategory
                ? "换一个分类看看，或者第一个发布你的 AI 视频作品。"
                : "成为第一个发布作品的创作者，让你的 AI 视频被社区看到。"
            }
            action={
              <>
                {activeCategory && (
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={<Link href="/showcase" />}
                  >
                    查看全部分类
                  </Button>
                )}
                <Button
                  size="sm"
                  nativeButton={false}
                  render={<Link href="/create-work" />}
                >
                  <Upload className="size-3.5" />
                  发布作品
                </Button>
              </>
            }
          />
        ) : (
          <section className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3 2xl:grid-cols-4">
            {items.map((w) => (
              <WorkCard
                key={w.id}
                work={w}
                signedIn={signedIn}
                liked={interactions.likedWorkIds.has(w.id)}
                bookmarked={interactions.bookmarkedWorkIds.has(w.id)}
              />
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
