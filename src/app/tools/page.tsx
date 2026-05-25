import Link from "next/link";
import { Filter, Search, Sparkles, Wrench } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChip } from "@/components/ui/filter-chip";
import { ToolCard, type ToolCardItem } from "@/components/feed/tool-card";
import { prisma } from "@/lib/db";
import {
  isToolCategoryValue,
  toolCategoryMeta,
  TOOL_CATEGORY_ORDER,
  type ToolCategoryValue,
  type ToolPricingValue,
} from "@/lib/tools/categories";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ category?: string; q?: string }>;

async function getTools(category: ToolCategoryValue | null, q: string | null) {
  const trimmed = q?.trim();
  return prisma.tool.findMany({
    where: {
      ...(category ? { category } : {}),
      ...(trimmed
        ? {
            OR: [
              { name: { contains: trimmed, mode: "insensitive" } },
              { description: { contains: trimmed, mode: "insensitive" } },
              { useCase: { contains: trimmed, mode: "insensitive" } },
              { tags: { has: trimmed } },
            ],
          }
        : {}),
    },
    orderBy: [{ isOfficial: "desc" }, { createdAt: "desc" }],
    take: 120,
  });
}

async function getCategoryCounts(
  q: string | null,
): Promise<Record<string, number>> {
  const trimmed = q?.trim();
  const rows = await prisma.tool.groupBy({
    by: ["category"],
    where: trimmed
      ? {
          OR: [
            { name: { contains: trimmed, mode: "insensitive" } },
            { description: { contains: trimmed, mode: "insensitive" } },
            { useCase: { contains: trimmed, mode: "insensitive" } },
            { tags: { has: trimmed } },
          ],
        }
      : undefined,
    _count: { _all: true },
  });
  const result: Record<string, number> = {};
  for (const row of rows) result[row.category] = row._count._all;
  return result;
}

export default async function ToolsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { category: rawCategory, q: rawQ } = await searchParams;
  const activeCategory = isToolCategoryValue(rawCategory) ? rawCategory : null;
  const query = typeof rawQ === "string" ? rawQ : "";

  const [tools, counts] = await Promise.all([
    getTools(activeCategory, query || null),
    getCategoryCounts(query || null),
  ]);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const items: ToolCardItem[] = tools.map((t) => ({
    id: t.id,
    slug: t.slug,
    name: t.name,
    description: t.description,
    url: t.url,
    category: t.category,
    useCase: t.useCase,
    logoUrl: t.logoUrl,
    pricing: t.pricing as ToolPricingValue,
    tags: t.tags,
    isOfficial: t.isOfficial,
  }));

  const queryWithCategory = (cat: ToolCategoryValue | null) => {
    const params = new URLSearchParams();
    if (cat) params.set("category", cat);
    if (query) params.set("q", query);
    const s = params.toString();
    return s ? `/tools?${s}` : "/tools";
  };

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        eyebrow="工具库"
        title="Tools · AI 视频工具导航"
        description="社区精选 + 官方集成的 AI 视频全链路工具集。按工具类型筛选，或直接搜索名称、标签、适用场景。"
        actions={
          <>
            <form method="GET" action="/tools" className="relative">
              {activeCategory && (
                <input type="hidden" name="category" value={activeCategory} />
              )}
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="搜索工具 / 标签 / 场景..."
                className="h-8 w-44 rounded-md border border-border/60 bg-card/40 pl-8 pr-3 text-sm focus-ring sm:w-56"
              />
            </form>
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href="/community" />}
            >
              <Wrench className="size-3.5" />
              推荐工具
            </Button>
          </>
        }
      />

      <div className="space-y-5 px-4 py-5 sm:px-8 sm:py-6">
        <section className="surface-card p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <Filter className="size-3.5" />
            工具类型
            <span className="text-muted-foreground/60">
              · 共 {total} 个{query ? `匹配 "${query}" 的` : ""}工具
            </span>
          </div>
          <div className="-mx-1 flex flex-nowrap gap-2 overflow-x-auto px-1 scroll-x-snap sm:flex-wrap sm:overflow-visible">
            <FilterChip
              href={queryWithCategory(null)}
              active={!activeCategory}
              label="全部"
              emoji="🌐"
              count={total}
              tone="bg-primary/15 text-primary border-primary/30"
            />
            {TOOL_CATEGORY_ORDER.map((c) => {
              const meta = toolCategoryMeta(c);
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

        <section className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="inline-flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            {activeCategory ? (
              <>
                筛选：
                <span className="font-medium text-foreground">
                  {toolCategoryMeta(activeCategory).label}
                </span>
                <span className="text-muted-foreground/60">
                  · {items.length} 个工具
                </span>
              </>
            ) : query ? (
              <>
                关键词：
                <span className="font-medium text-foreground">
                  &ldquo;{query}&rdquo;
                </span>
                <span className="text-muted-foreground/60">
                  · 共 {items.length} 条匹配
                </span>
              </>
            ) : (
              <>
                按推荐排序 · 官方工具置顶 ·{" "}
                <span className="font-medium text-foreground">
                  {items.length}
                </span>{" "}
                个工具
              </>
            )}
          </div>
          {(activeCategory || query) && (
            <Link
              href="/tools"
              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              清除筛选
            </Link>
          )}
        </section>

        {items.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title={
              activeCategory || query
                ? "当前筛选下没有匹配工具"
                : "工具库还没有数据"
            }
            description={
              activeCategory || query
                ? "换一个类型或关键词试试，或者前往社区工具频道推荐工具。"
                : "等待管理员录入官方工具，或前往社区推荐你常用的工具。"
            }
            action={
              (activeCategory || query) && (
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<Link href="/tools" />}
                >
                  清除筛选
                </Button>
              )
            }
          />
        ) : (
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {items.map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </section>
        )}

        <section className="surface-dashed p-5 text-center">
          <p className="text-sm text-muted-foreground">
            没找到合适的工具？前往社区{" "}
            <Link
              href="/community/tooling"
              className="font-medium text-primary hover:underline"
            >
              工具与流水线频道
            </Link>{" "}
            推荐或求助。
          </p>
        </section>
      </div>
    </div>
  );
}
