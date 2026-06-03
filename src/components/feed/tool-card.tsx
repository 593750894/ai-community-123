import Link from "next/link";
import { ArrowUpRight, ExternalLink, Sparkles, Star, Target } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  toolCategoryMeta,
  TOOL_PRICING_LABEL,
  TOOL_PRICING_TONE,
  type ToolPricingValue,
} from "@/lib/tools/categories";

export type ToolCardItem = {
  id: string;
  slug: string;
  name: string;
  description: string;
  url: string;
  category: string;
  useCase: string | null;
  logoUrl: string | null;
  pricing: ToolPricingValue;
  tags: string[];
  isOfficial: boolean;
  avgRating?: number | null;
  ratingCount?: number;
};

export function ToolCard({ tool }: { tool: ToolCardItem }) {
  const meta = toolCategoryMeta(tool.category);
  const detailHref = `/tools/${tool.slug}`;
  const externalUrl = tool.url;
  const isInternal = externalUrl.startsWith("/");

  return (
    <div
      className={cn(
        "group relative flex h-full flex-col gap-3 overflow-hidden rounded-2xl border bg-card/40 p-4 transition-all hover:-translate-y-0.5",
        tool.isOfficial
          ? "border-primary/40 bg-gradient-to-br from-primary/10 via-card/40 to-card/20 hover:border-primary/60 hover:shadow-[0_12px_40px_-12px_rgba(56,189,248,0.45)]"
          : "border-border/60 hover:border-primary/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <Link
          href={detailHref}
          className="flex flex-1 items-start gap-3 outline-none focus-visible:opacity-90"
          aria-label={`${tool.name} 详情`}
        >
          <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-background/50 ring-1 ring-inset ring-border/60">
            {tool.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tool.logoUrl} alt={tool.name} className="size-full object-cover" />
            ) : (
              <span className="text-base" aria-hidden>
                {meta.emoji}
              </span>
            )}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold leading-snug">
                {tool.name}
              </span>
              {tool.isOfficial && (
                <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                  <Sparkles className="size-2.5" />
                  官方
                </span>
              )}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px]",
                  meta.tone,
                )}
              >
                <span aria-hidden>{meta.emoji}</span>
                {meta.label}
              </span>
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px]",
                  TOOL_PRICING_TONE[tool.pricing],
                )}
              >
                {TOOL_PRICING_LABEL[tool.pricing]}
              </span>
            </div>
          </div>
        </Link>
        <a
          href={externalUrl}
          target={isInternal ? undefined : "_blank"}
          rel={isInternal ? undefined : "noreferrer noopener"}
          className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-border/50 bg-background/40 px-1.5 py-1 text-[10px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
          aria-label={`前往 ${tool.name} 官网`}
          title="前往官网"
        >
          官网
          <ArrowUpRight className="size-3" />
        </a>
      </div>

      <Link
        href={detailHref}
        className="flex flex-1 flex-col gap-3 outline-none focus-visible:opacity-90"
      >
        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {tool.description}
        </p>

        {tool.useCase && (
          <div className="flex items-start gap-1.5 rounded-md border border-border/40 bg-muted/30 px-2.5 py-1.5 text-[11px] leading-snug text-muted-foreground">
            <Target className="mt-0.5 size-3 shrink-0 text-primary/70" />
            <span className="line-clamp-2">{tool.useCase}</span>
          </div>
        )}

        {tool.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tool.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/30 pt-2 text-[11px] text-muted-foreground tabular-nums">
          <ToolRatingPill
            avg={tool.avgRating ?? null}
            count={tool.ratingCount ?? 0}
          />
          <span className="inline-flex items-center gap-0.5 text-muted-foreground/80 group-hover:text-primary">
            查看详情
            <ExternalLink className="size-3" />
          </span>
        </div>
      </Link>
    </div>
  );
}

function ToolRatingPill({
  avg,
  count,
}: {
  avg: number | null;
  count: number;
}) {
  if (count === 0 || avg == null) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground/60">
        <Star className="size-3" />
        暂无评分
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-amber-300">
      <Star className="size-3 fill-amber-300 text-amber-300" />
      <span className="font-semibold">{avg.toFixed(1)}</span>
      <span className="text-muted-foreground/70">· {count} 条</span>
    </span>
  );
}
