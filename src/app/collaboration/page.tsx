import Link from "next/link";
import {
  Banknote,
  Briefcase,
  Clock,
  Filter,
  Handshake,
  Plus,
  ShieldCheck,
  UserPlus,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChip, StatusChip } from "@/components/ui/filter-chip";
import { StatCard } from "@/components/ui/stat-card";
import {
  CollaborationCard,
  type CollabCardItem,
} from "@/components/feed/collaboration-card";
import { prisma } from "@/lib/db";
import {
  COLLAB_CATEGORY_ORDER,
  COLLAB_STATUS_LABEL,
  COLLAB_STATUS_TONE,
  COLLAB_STATUS_VALUES,
  collabCategoryMeta,
  type CollabCategoryValue,
  type CollabLocationValue,
  type CollabStatusValue,
  type CollabWorkModeValue,
} from "@/lib/collaborations/categories";
import type {
  CollaborationCategory,
  CollaborationStatus,
} from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ category?: string; status?: string }>;

async function getCollaborations(
  category: CollabCategoryValue | null,
  status: CollabStatusValue | null,
) {
  return prisma.collaboration.findMany({
    where: {
      ...(category ? { category: category as CollaborationCategory } : {}),
      ...(status ? { status: status as CollaborationStatus } : {}),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      author: {
        select: {
          id: true,
          name: true,
          username: true,
          avatar: true,
          industryRole: true,
        },
      },
    },
    take: 80,
  });
}

async function getCategoryCounts(): Promise<Record<string, number>> {
  const rows = await prisma.collaboration.groupBy({
    by: ["category"],
    _count: { _all: true },
  });
  const result: Record<string, number> = {};
  for (const row of rows) result[row.category] = row._count._all;
  return result;
}

async function getStats() {
  const [openCount, totalCount, weekCount] = await Promise.all([
    prisma.collaboration.count({ where: { status: "OPEN" } }),
    prisma.collaboration.count(),
    prisma.collaboration.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);
  const creatorCount = await prisma.user.count();
  return { openCount, totalCount, weekCount, creatorCount };
}

export default async function CollaborationPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { category: rawCategory, status: rawStatus } = await searchParams;
  const activeCategory =
    rawCategory && (COLLAB_CATEGORY_ORDER as string[]).includes(rawCategory)
      ? (rawCategory as CollabCategoryValue)
      : null;
  const activeStatus =
    rawStatus && (COLLAB_STATUS_VALUES as readonly string[]).includes(rawStatus)
      ? (rawStatus as CollabStatusValue)
      : null;

  const [rows, counts, stats] = await Promise.all([
    getCollaborations(activeCategory, activeStatus),
    getCategoryCounts(),
    getStats(),
  ]);

  const items: CollabCardItem[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    category: r.category as CollabCategoryValue,
    workMode: r.workMode as CollabWorkModeValue,
    location: r.location as CollabLocationValue,
    status: r.status as CollabStatusValue,
    budget: r.budget,
    tags: r.tags,
    createdAt: r.createdAt,
    author: r.author,
  }));

  const totalForCategory = activeCategory
    ? counts[activeCategory] ?? 0
    : stats.totalCount;

  const queryWithStatus = (status: CollabStatusValue | null) => {
    const params = new URLSearchParams();
    if (activeCategory) params.set("category", activeCategory);
    if (status) params.set("status", status);
    const s = params.toString();
    return s ? `/collaboration?${s}` : "/collaboration";
  };

  const queryWithCategory = (cat: CollabCategoryValue | null) => {
    const params = new URLSearchParams();
    if (cat) params.set("category", cat);
    if (activeStatus) params.set("status", activeStatus);
    const s = params.toString();
    return s ? `/collaboration?${s}` : "/collaboration";
  };

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        eyebrow="项目合作"
        title="Collaboration · 项目市场"
        description="发布合作需求、组队接单、找认证创作者。从 AI 短剧到数字人、从 ComfyUI 搭建到联合创始人。"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/showcase" />}
            >
              <Handshake className="size-3.5" />
              看作品库
            </Button>
            <Button
              size="sm"
              nativeButton={false}
              render={<Link href="/collaboration/new" />}
            >
              <Plus className="size-3.5" />
              发布合作
            </Button>
          </>
        }
      />

      <div className="space-y-5 px-4 py-5 sm:px-8 sm:py-6">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="开放中需求"
            value={stats.openCount}
            icon={Briefcase}
            tone="text-emerald-300"
          />
          <StatCard
            label="本周新发布"
            value={stats.weekCount}
            icon={Clock}
            tone="text-cyan-300"
          />
          <StatCard
            label="累计合作"
            value={stats.totalCount}
            icon={Handshake}
            tone="text-fuchsia-300"
          />
          <StatCard
            label="平台创作者"
            value={stats.creatorCount}
            icon={UserPlus}
            tone="text-amber-300"
          />
        </section>

        <section className="surface-card p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <Filter className="size-3.5" />
            合作类型
            <span className="text-muted-foreground/60">
              · 共 {stats.totalCount} 个合作机会
            </span>
          </div>
          <div className="-mx-1 flex flex-nowrap gap-2 overflow-x-auto px-1 scroll-x-snap sm:flex-wrap sm:overflow-visible">
            <FilterChip
              href={queryWithCategory(null)}
              active={!activeCategory}
              label="全部"
              emoji="🌐"
              count={stats.totalCount}
              tone="bg-primary/15 text-primary border-primary/30"
            />
            {COLLAB_CATEGORY_ORDER.map((c) => {
              const meta = collabCategoryMeta(c);
              return (
                <FilterChip
                  key={c}
                  href={queryWithCategory(c)}
                  active={activeCategory === c}
                  label={meta.label}
                  emoji={meta.emoji}
                  count={counts[c] ?? 0}
                  tone={meta.tone}
                />
              );
            })}
          </div>
        </section>

        <section className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="size-4 text-primary" />
            {activeCategory ? (
              <>
                筛选：
                <span className="font-medium text-foreground">
                  {collabCategoryMeta(activeCategory).label}
                </span>
                <span className="text-muted-foreground/60">
                  · {totalForCategory} 个机会
                </span>
              </>
            ) : (
              <>
                按状态排序 ·{" "}
                <span className="font-medium text-foreground">{items.length}</span>{" "}
                条合作信息
              </>
            )}
          </div>
          <div className="-mx-1 flex flex-nowrap gap-1.5 overflow-x-auto px-1 text-xs scroll-x-snap sm:flex-wrap sm:overflow-visible">
            <StatusChip
              href={queryWithStatus(null)}
              active={!activeStatus}
              label="全部状态"
              tone="bg-muted/50 text-foreground"
            />
            {COLLAB_STATUS_VALUES.map((s) => (
              <StatusChip
                key={s}
                href={queryWithStatus(s)}
                active={activeStatus === s}
                label={COLLAB_STATUS_LABEL[s]}
                tone={COLLAB_STATUS_TONE[s]}
              />
            ))}
          </div>
        </section>

        {items.length === 0 ? (
          <EmptyState
            icon={Handshake}
            title={
              activeCategory || activeStatus
                ? "当前筛选下没有合作需求"
                : "合作板块还没有任何需求"
            }
            description={
              activeCategory || activeStatus
                ? "换一个分类或状态，或者第一个发布需求。"
                : "成为第一个发布合作需求的创作者，组队完成你的项目。"
            }
            action={
              <Button
                size="sm"
                nativeButton={false}
                render={<Link href="/collaboration/new" />}
              >
                <Plus className="size-3.5" />
                发布合作
              </Button>
            }
          />
        ) : (
          <section className="grid gap-3 lg:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            {items.map((item) => (
              <CollaborationCard key={item.id} item={item} />
            ))}
          </section>
        )}

        <section className="surface-dashed p-5 text-center">
          <p className="text-sm text-muted-foreground">
            没有找到合适的合作？
            <Link
              href="/collaboration/new"
              className="ml-1 inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              <Banknote className="size-3.5" />
              直接发布你的需求
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
