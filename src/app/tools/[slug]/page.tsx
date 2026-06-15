import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Sparkles, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CountText } from "@/components/ui/count-text";
import { EmptyState } from "@/components/ui/empty-state";
import { PillTag } from "@/components/ui/pill-tag";
import { ToolRatingForm } from "@/components/tools/tool-rating-form";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import {
  toolCategoryMeta,
  TOOL_PRICING_LABEL,
  TOOL_PRICING_TINT,
  type ToolPricingValue,
} from "@/lib/tools/categories";
import {
  getToolRatingSummary,
  getViewerRating,
  listToolRatings,
} from "@/lib/tools/ratings";
import { formatRelativeTime, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ToolDetailPage({ params }: PageProps) {
  const { slug } = await params;

  const tool = await prisma.tool.findUnique({
    where: { slug },
    include: {
      createdBy: {
        select: { id: true, username: true, name: true, avatar: true },
      },
    },
  });
  if (!tool) notFound();

  const session = await getSession();
  const meta = toolCategoryMeta(tool.category);
  const pricing = tool.pricing as ToolPricingValue;
  const isInternalUrl = tool.url.startsWith("/");

  const [summary, viewerRating, ratings] = await Promise.all([
    getToolRatingSummary(tool.id),
    session ? getViewerRating({ toolId: tool.id, userId: session.userId }) : null,
    listToolRatings({ toolId: tool.id, pageSize: 20 }),
  ]);

  const detailPath = `/tools/${tool.slug}`;

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border px-4 py-5 sm:px-8 sm:py-6">
        <Link
          href="/tools"
          className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          返回工具库
        </Link>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-background/50 ring-1 ring-inset ring-border">
              {tool.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={tool.logoUrl}
                  alt={tool.name}
                  className="size-full object-cover"
                />
              ) : (
                <meta.icon className="size-7 text-muted-foreground" aria-hidden />
              )}
            </span>
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">
                  {tool.name}
                </h1>
                {tool.isOfficial && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
                    <Sparkles className="size-3" />
                    官方推荐
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <PillTag tint={meta.tint} icon={null}>
                  <meta.icon className="mr-0.5 size-3" aria-hidden />
                  {meta.label}
                </PillTag>
                <PillTag tint={TOOL_PRICING_TINT[pricing]} icon={null}>
                  {TOOL_PRICING_LABEL[pricing]}
                </PillTag>
                {tool.createdBy && (
                  <span className="text-muted-foreground">
                    由{" "}
                    <Link
                      href={`/u/${tool.createdBy.username}`}
                      className="hover:text-foreground hover:underline"
                    >
                      {tool.createdBy.name}
                    </Link>{" "}
                    收录
                  </span>
                )}
              </div>
              <p className="max-w-2xl text-sm text-muted-foreground">
                {tool.description}
              </p>
            </div>
          </div>

          <Button
            nativeButton={false}
            render={
              isInternalUrl ? (
                <Link href={tool.url} />
              ) : (
                <a href={tool.url} target="_blank" rel="noreferrer noopener" />
              )
            }
          >
            <ExternalLink className="size-3.5" />
            前往官网
          </Button>
        </div>
      </header>

      <div className="grid gap-5 px-4 py-5 sm:px-8 sm:py-6 lg:grid-cols-[2fr_3fr]">
        <aside className="space-y-4">
          <RatingSummaryCard summary={summary} />

          <ToolRatingForm
            toolSlug={tool.slug}
            signedIn={Boolean(session)}
            loginNext={detailPath}
            initialStars={viewerRating?.stars ?? null}
            initialComment={viewerRating?.comment ?? null}
          />

          {tool.useCase && (
            <div className="surface-card p-4 text-sm leading-relaxed text-muted-foreground">
              <div className="mb-1 text-xs font-medium text-foreground">
                适用场景
              </div>
              {tool.useCase}
            </div>
          )}

          {tool.tags.length > 0 && (
            <div className="surface-card p-4">
              <div className="mb-2 text-xs font-medium">标签</div>
              <div className="flex flex-wrap gap-1.5">
                {tool.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-md bg-muted/50 px-1.5 py-0.5 text-[11px] text-muted-foreground"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </aside>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              全部评价
              <span className="ml-2 text-xs text-muted-foreground">
                {ratings.total > 0 ? `共 ${ratings.total} 条` : "暂无评价"}
              </span>
            </h2>
          </div>

          {ratings.items.length === 0 ? (
            <EmptyState
              icon={Star}
              title="暂无评价"
              description="第一个分享你的使用体验，帮助社区其他创作者选型。"
            />
          ) : (
            <ul className="space-y-3">
              {ratings.items.map((r) => (
                <li
                  key={r.id}
                  className="surface-card flex flex-col gap-2 p-4 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={`/u/${r.user.username}`}
                      className="flex items-center gap-2 hover:opacity-90"
                    >
                      {r.user.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.user.avatar}
                          alt={r.user.name}
                          className="size-7 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-xs font-medium text-primary">
                          {r.user.name.slice(0, 1)}
                        </span>
                      )}
                      <span className="text-sm font-medium hover:text-primary">
                        {r.user.name}
                      </span>
                    </Link>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <StarRow stars={r.stars} />
                      <span>{formatRelativeTime(r.createdAt)}</span>
                    </div>
                  </div>
                  {r.comment && (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">
                      {r.comment}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}

          {ratings.hasMore && (
            <div className="text-center text-xs text-muted-foreground">
              当前展示前 {ratings.items.length} 条 · 后续分页加载功能将在下一阶段补齐
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function RatingSummaryCard({
  summary,
}: {
  summary: {
    avgRating: number | null;
    ratingCount: number;
    histogram: Record<1 | 2 | 3 | 4 | 5, number>;
  };
}) {
  const total = summary.ratingCount;
  return (
    <div className="surface-card p-4">
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-center justify-center">
          <div className="text-3xl font-semibold tabular-nums text-amber-600 dark:text-tag-amber-fg">
            {summary.avgRating != null ? summary.avgRating.toFixed(1) : "—"}
          </div>
          <StarRow
            stars={Math.round(summary.avgRating ?? 0)}
            size="md"
          />
          <div className="mt-1 text-[11px] text-muted-foreground">
            {total > 0 ? `${total} 条评价` : "暂无评价"}
          </div>
        </div>
        <div className="flex-1 space-y-1">
          {[5, 4, 3, 2, 1].map((s) => {
            const count = summary.histogram[s as 1 | 2 | 3 | 4 | 5];
            const pct = total > 0 ? (count / total) * 100 : 0;
            return (
              <div key={s} className="flex items-center gap-2 text-[11px]">
                <CountText value={s} className="w-3 text-muted-foreground" />
                <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="absolute inset-y-0 left-0 bg-tag-amber-bg/80 dark:bg-amber-300/80"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <CountText value={count} className="w-6 text-right text-muted-foreground" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StarRow({
  stars,
  size = "sm",
}: {
  stars: number;
  size?: "sm" | "md";
}) {
  const px = size === "md" ? "size-4" : "size-3";
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            px,
            n <= stars
              ? "fill-amber-500 text-amber-500 dark:fill-amber-300 dark:text-tag-amber-fg"
              : "text-muted-foreground/30",
          )}
        />
      ))}
    </span>
  );
}
