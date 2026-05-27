"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { cn } from "@/lib/utils";
import { POST_TYPE_VALUES, POST_TYPE_META, type PostTypeValue } from "@/lib/post-types";

const ALL_LABEL = "全部";

export function PostTypeFilter({ current }: { current?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setType = useCallback(
    (type: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString());
      if (type) {
        params.set("type", type);
      } else {
        params.delete("type");
      }
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  return (
    <div className="flex flex-wrap gap-1.5 overflow-x-auto scroll-x-snap pb-0.5">
      <button
        onClick={() => setType(undefined)}
        className={cn(
          "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all",
          !current
            ? "border-primary/40 bg-primary/10 text-primary shadow-[0_0_12px_rgba(var(--color-primary)/0.15)]"
            : "border-border/40 bg-card/30 text-muted-foreground hover:border-primary/30 hover:bg-card/50 hover:text-foreground",
        )}
      >
        {ALL_LABEL}
      </button>
      {POST_TYPE_VALUES.map((type) => {
        const meta = POST_TYPE_META[type as PostTypeValue];
        const active = current === type;
        return (
          <button
            key={type}
            onClick={() => setType(type)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all",
              active
                ? meta.tone + " border-current/30 shadow-sm"
                : "border-border/40 bg-card/30 text-muted-foreground hover:border-primary/30 hover:bg-card/50 hover:text-foreground",
            )}
          >
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}
