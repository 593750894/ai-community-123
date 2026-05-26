"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { ArrowDownWideNarrow, Flame } from "lucide-react";

import { cn } from "@/lib/utils";

const SORT_OPTIONS = [
  { value: "latest", label: "最新", icon: ArrowDownWideNarrow },
  { value: "hot", label: "热门", icon: Flame },
] as const;

export function PostSortSelect({ current = "latest" }: { current?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setSort = useCallback(
    (sort: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (sort === "latest") {
        params.delete("sort");
      } else {
        params.set("sort", sort);
      }
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border/40 bg-card/30 p-0.5">
      {SORT_OPTIONS.map((opt) => {
        const active = current === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => setSort(opt.value)}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              active
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <opt.icon className="size-3" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
