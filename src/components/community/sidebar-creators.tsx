import Link from "next/link";
import { Crown, FileVideo, MessageSquare, ArrowUpRight, UserPlus } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { InlineError } from "@/components/ui/error-state";

export type SidebarCreatorData = {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
  industryRole: string | null;
  _count: { posts: number; works: number };
};

export function SidebarCreators({
  creators,
  error = false,
}: {
  creators: SidebarCreatorData[];
  error?: boolean;
}) {
  return (
    <section className="surface-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/90">
          <Crown className="size-3.5 text-primary" />
          活跃创作者
        </div>
        <Link
          href="/community/leaderboard"
          className="text-[11px] text-muted-foreground transition-colors hover:text-primary"
        >
          排行榜
        </Link>
      </div>

      {error ? (
        <InlineError message="创作者数据加载失败" />
      ) : creators.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="暂无活跃创作者"
          description="发布作品后你可能出现在这里。"
          className="border-none bg-transparent py-6"
        />
      ) : (
        <ul className="space-y-1">
          {creators.map((user) => (
            <li key={user.id}>
              <div className="group flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50">
                <Link href={`/profile/${user.id}`} className="shrink-0">
                  {user.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="size-9 rounded-full border border-border/60"
                    />
                  ) : (
                    <span className="flex size-9 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground">
                      {user.name.slice(0, 1)}
                    </span>
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/profile/${user.id}`}
                    className="truncate text-sm font-medium hover:text-primary"
                  >
                    {user.name}
                  </Link>
                  {user.industryRole && (
                    <div className="truncate text-[11px] text-muted-foreground">
                      {user.industryRole}
                    </div>
                  )}
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground tabular-nums">
                    <span className="inline-flex items-center gap-0.5">
                      <MessageSquare className="size-2.5" />
                      {user._count.posts}
                    </span>
                    <span className="inline-flex items-center gap-0.5">
                      <FileVideo className="size-2.5" />
                      {user._count.works}
                    </span>
                  </div>
                </div>
                <Link
                  href={`/profile/${user.id}`}
                  className="shrink-0 rounded-md border border-border/50 px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <span className="hidden items-center gap-0.5 sm:inline-flex">
                    主页
                    <ArrowUpRight className="size-3" />
                  </span>
                  <ArrowUpRight className="size-3 sm:hidden" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
