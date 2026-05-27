"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

export function PostPagination({
  page,
  totalPages,
}: {
  page: number;
  totalPages: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const goTo = useCallback(
    (p: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (p <= 1) {
        params.delete("page");
      } else {
        params.set("page", String(p));
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 pt-4">
      <button
        disabled={page <= 1}
        onClick={() => goTo(page - 1)}
        className={cn(
          "inline-flex size-9 items-center justify-center rounded-lg border border-border/40 bg-card/30 text-muted-foreground transition-all",
          page <= 1
            ? "cursor-not-allowed opacity-30"
            : "hover:border-primary/30 hover:bg-primary/10 hover:text-primary",
        )}
      >
        <ChevronLeft className="size-4" />
      </button>

      <div className="flex items-center gap-1 rounded-lg border border-border/30 bg-card/20 px-3 py-1.5">
        <span className="text-xs font-semibold tabular-nums text-primary">
          {page}
        </span>
        <span className="text-xs text-muted-foreground/50">/</span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {totalPages}
        </span>
      </div>

      <button
        disabled={page >= totalPages}
        onClick={() => goTo(page + 1)}
        className={cn(
          "inline-flex size-9 items-center justify-center rounded-lg border border-border/40 bg-card/30 text-muted-foreground transition-all",
          page >= totalPages
            ? "cursor-not-allowed opacity-30"
            : "hover:border-primary/30 hover:bg-primary/10 hover:text-primary",
        )}
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
