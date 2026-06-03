import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

// Stage 7 · /me pages 用 SSR-friendly 翻页：直接渲染 Link，每次跳页带 ?page=N。
// 故意不依赖客户端 hooks（与 PostPagination 不同），让 /me 路由保持 RSC-only。
export function MePager({
  basePath,
  page,
  totalPages,
}: {
  basePath: string;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  const prevHref = page > 1
    ? page - 1 === 1
      ? basePath
      : `${basePath}?page=${page - 1}`
    : null;
  const nextHref = page < totalPages ? `${basePath}?page=${page + 1}` : null;

  return (
    <div className="flex items-center justify-center gap-2 pt-4">
      <PagerLink href={prevHref} label="上一页">
        <ChevronLeft className="size-4" />
      </PagerLink>

      <div className="flex items-center gap-1 rounded-lg border border-border/30 bg-card/20 px-3 py-1.5">
        <span className="text-xs font-semibold tabular-nums text-primary">
          {page}
        </span>
        <span className="text-xs text-muted-foreground/50">/</span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {totalPages}
        </span>
      </div>

      <PagerLink href={nextHref} label="下一页">
        <ChevronRight className="size-4" />
      </PagerLink>
    </div>
  );
}

function PagerLink({
  href,
  label,
  children,
}: {
  href: string | null;
  label: string;
  children: React.ReactNode;
}) {
  const baseCls =
    "inline-flex size-9 items-center justify-center rounded-lg border border-border/40 bg-card/30 text-muted-foreground transition-all";
  if (!href) {
    return (
      <span
        aria-disabled="true"
        aria-label={label}
        className={cn(baseCls, "cursor-not-allowed opacity-30")}
      >
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        baseCls,
        "hover:border-primary/30 hover:bg-primary/10 hover:text-primary",
      )}
    >
      {children}
    </Link>
  );
}
