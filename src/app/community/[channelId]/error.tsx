"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, ArrowLeft } from "lucide-react";

export default function ChannelDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[channel-detail]", error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-destructive/15 text-destructive">
        <AlertTriangle className="size-6" />
      </span>
      <h2 className="text-lg font-semibold text-foreground">
        频道页面加载失败
      </h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        无法加载此频道的内容，请稍后再试。
      </p>
      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <RotateCcw className="size-3.5" />
          重试
        </button>
        <Link
          href="/community"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50"
        >
          <ArrowLeft className="size-3.5" />
          返回社区
        </Link>
      </div>
    </div>
  );
}
