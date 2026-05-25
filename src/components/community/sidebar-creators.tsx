import Link from "next/link";
import { Crown, FileVideo, MessageSquare } from "lucide-react";

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
}: {
  creators: SidebarCreatorData[];
}) {
  if (creators.length === 0) return null;

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
      <ul className="space-y-1">
        {creators.map((user) => (
          <li key={user.id}>
            <Link
              href={`/profile/${user.id}`}
              className="group flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50"
            >
              {user.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="size-8 shrink-0 rounded-full border border-border/60"
                />
              ) : (
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground">
                  {user.name.slice(0, 1)}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium group-hover:text-primary">
                  {user.name}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground tabular-nums">
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
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
