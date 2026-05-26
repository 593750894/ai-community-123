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
    <div className="flex items-center justify-center gap-1.5 pt-2">
      <button
        disabled={page <= 1}
        onClick={() => goTo(page - 1)}
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-lg border border-border/40 text-muted-foreground transition-colors",
          page <= 1
            ? "cursor-not-allowed opacity-40"
            : "hover:border-primary/30 hover:text-foreground",
        )}
      >
        <ChevronLeft className="size-4" />
      </button>

      <span className="px-2 text-xs tabular-nums text-muted-foreground">
        {page} / {totalPages}
      </span>

      <button
        disabled={page >= totalPages}
        onClick={() => goTo(page + 1)}
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-lg border border-border/40 text-muted-foreground transition-colors",
          page >= totalPages
            ? "cursor-not-allowed opacity-40"
            : "hover:border-primary/30 hover:text-foreground",
        )}
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
