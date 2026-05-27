import Link from "next/link";
import { Hash, ArrowLeft } from "lucide-react";

export default function ChannelNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-muted/40 text-muted-foreground">
        <Hash className="size-6" />
      </span>
      <h2 className="text-lg font-semibold text-foreground">
        频道不存在
      </h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        这个频道暂时不存在，可能已被移动或删除。
      </p>
      <Link
        href="/community"
        className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <ArrowLeft className="size-3.5" />
        返回社区
      </Link>
    </div>
  );
}
