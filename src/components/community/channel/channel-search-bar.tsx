"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Search, X } from "lucide-react";

export function ChannelSearchBar({ current }: { current?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(current ?? "");

  const submit = useCallback(
    (q: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const trimmed = q.trim();
      if (trimmed) {
        params.set("q", trimmed);
      } else {
        params.delete("q");
      }
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(value);
      }}
      className="group relative"
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="搜索此频道帖子…"
        className="h-9 w-full rounded-lg border border-border/40 bg-card/30 pl-8 pr-8 text-xs text-foreground placeholder:text-muted-foreground/60 transition-all focus:border-primary/40 focus:bg-card/50 focus:outline-none focus:ring-2 focus:ring-primary/15 sm:w-60"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            setValue("");
            submit("");
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="size-3" />
        </button>
      )}
    </form>
  );
}
