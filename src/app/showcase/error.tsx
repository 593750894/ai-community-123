"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";

export default function ShowcaseError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="px-4 py-10 sm:px-8">
      <ErrorState
        title="无法加载作品广场"
        description={
          error?.message ||
          "请稍后重试，或者检查网络。错误日志已经记录到服务端。"
        }
        action={
          <>
            <Button size="sm" variant="outline" onClick={reset}>
              重试
            </Button>
            <Button
              size="sm"
              nativeButton={false}
              render={<Link href="/" />}
            >
              返回首页
            </Button>
          </>
        }
      />
    </div>
  );
}
