import Link from "next/link";
import { Sparkles } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChip } from "@/components/ui/filter-chip";
import { WorkflowItemCard } from "@/components/commerce/workflow-item-card";
import { listPublicWorkflowItems } from "@/lib/commerce/queries";
import {
  WORKFLOW_ITEM_CATEGORIES,
  WORKFLOW_ITEM_CATEGORY_LABEL,
  type WorkflowItemCategory,
} from "@/lib/commerce/schemas";

export const metadata: Metadata = {
  title: "工作流市集 · SeedLand · V",
  description: "由社区创作者上架的 ComfyUI 工作流、Prompt 包、节点图与教程合集。",
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ category?: string; q?: string; page?: string }>;
}

function parseCategory(raw?: string): WorkflowItemCategory | undefined {
  if (!raw) return undefined;
  return (WORKFLOW_ITEM_CATEGORIES as readonly string[]).includes(raw)
    ? (raw as WorkflowItemCategory)
    : undefined;
}

function parsePage(raw?: string): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}

export default async function MarketplacePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const category = parseCategory(params.category);
  const q = params.q?.trim() || undefined;
  const page = parsePage(params.page);

  const { items, total, pageSize } = await listPublicWorkflowItems({
    category,
    q,
    page,
    pageSize: 24,
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <PageHeader
        eyebrow="工作流市集"
        title="发现高质量 AI 视频创作素材"
        description="ComfyUI 工作流、Prompt 包、节点图、LoRA 与教程合集，由社区创作者直接上架。"
        actions={
          <Button
            size="sm"
            nativeButton={false}
            render={<Link href="/me/workflows/new" />}
          >
            上架我的工作流
          </Button>
        }
      />

      <div className="space-y-6 px-4 py-5 sm:px-8 sm:py-6">
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            href={buildHref({ category: undefined, q })}
            active={!category}
            label="全部"
          />
          {WORKFLOW_ITEM_CATEGORIES.map((c) => (
            <FilterChip
              key={c}
              href={buildHref({ category: c, q })}
              active={category === c}
              label={WORKFLOW_ITEM_CATEGORY_LABEL[c]}
            />
          ))}
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title={q || category ? "没有匹配的商品" : "市集还很安静"}
            description={
              q || category
                ? "换个筛选条件再试试，或第一个上架属于你的工作流。"
                : "成为社区里第一位创作者，把你的工作流分享给大家。"
            }
            action={
              <Button
                size="sm"
                nativeButton={false}
                render={<Link href="/me/workflows/new" />}
              >
                上架我的工作流
              </Button>
            }
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((item) => (
                <WorkflowItemCard key={item.id} item={item} />
              ))}
            </div>

            {totalPages > 1 && (
              <Pager
                page={page}
                totalPages={totalPages}
                makeHref={(p) => buildHref({ category, q, page: p })}
              />
            )}

            <p className="text-center text-[11px] text-muted-foreground/60">
              共 {total} 件商品 · 第 {page} / {totalPages} 页
            </p>
          </>
        )}
      </div>
    </>
  );
}

function buildHref(opts: {
  category?: WorkflowItemCategory;
  q?: string;
  page?: number;
}): string {
  const search = new URLSearchParams();
  if (opts.category) search.set("category", opts.category);
  if (opts.q) search.set("q", opts.q);
  if (opts.page && opts.page > 1) search.set("page", String(opts.page));
  const qs = search.toString();
  return qs ? `/marketplace?${qs}` : "/marketplace";
}

function Pager({
  page,
  totalPages,
  makeHref,
}: {
  page: number;
  totalPages: number;
  makeHref: (p: number) => string;
}) {
  const prev = Math.max(1, page - 1);
  const next = Math.min(totalPages, page + 1);
  return (
    <nav className="flex items-center justify-center gap-2 text-xs">
      <Link
        href={makeHref(prev)}
        aria-disabled={page <= 1}
        className="rounded-md border border-border/60 px-3 py-1 text-muted-foreground hover:text-foreground aria-disabled:pointer-events-none aria-disabled:opacity-40"
      >
        ← 上一页
      </Link>
      <span className="text-muted-foreground">
        {page} / {totalPages}
      </span>
      <Link
        href={makeHref(next)}
        aria-disabled={page >= totalPages}
        className="rounded-md border border-border/60 px-3 py-1 text-muted-foreground hover:text-foreground aria-disabled:pointer-events-none aria-disabled:opacity-40"
      >
        下一页 →
      </Link>
    </nav>
  );
}
