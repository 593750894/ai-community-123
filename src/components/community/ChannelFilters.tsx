"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { X } from "lucide-react";

import { PostTypeFilter } from "@/components/community/channel/post-type-filter";
import { PostSortSelect } from "@/components/community/channel/post-sort-select";
import { ChannelSearchBar } from "@/components/community/channel/channel-search-bar";
import { POST_TYPE_META, type PostTypeValue } from "@/lib/post-types";
import type { ChannelPostSort } from "@/types/community";

const SORT_LABELS: Record<ChannelPostSort, string> = {
  latest: "最新",
  hot: "热门",
  mostCommented: "最多评论",
  mostLiked: "最多点赞",
};

export function ChannelFilters({
  type,
  sort,
  search,
}: {
  type?: string;
  sort: ChannelPostSort;
  search?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeFilters = useMemo(() => {
    const tags: { label: string; param: string }[] = [];
    if (type && POST_TYPE_META[type as PostTypeValue]) {
      tags.push({ label: POST_TYPE_META[type as PostTypeValue].label, param: "type" });
    }
    if (sort !== "latest") {
      tags.push({ label: SORT_LABELS[sort], param: "sort" });
    }
    if (search) {
      tags.push({ label: `"${search}"`, param: "q" });
    }
    return tags;
  }, [type, sort, search]);

  const clearOne = useCallback(
    (param: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete(param);
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  const clearAll = useCallback(() => {
    router.push(pathname);
  }, [router, pathname]);

  return (
    <div className="space-y-3">
      <PostTypeFilter current={type} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <PostSortSelect current={sort} />
        <ChannelSearchBar current={search} />
      </div>

      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground/70">筛选中:</span>
          {activeFilters.map((f) => (
            <button
              key={f.param}
              onClick={() => clearOne(f.param)}
              className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[11px] text-primary transition-colors hover:bg-primary/10"
            >
              {f.label}
              <X className="size-2.5" />
            </button>
          ))}
          {activeFilters.length > 1 && (
            <button
              onClick={clearAll}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              清除全部
            </button>
          )}
        </div>
      )}
    </div>
  );
}
