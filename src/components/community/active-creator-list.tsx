import Link from "next/link";
import { FileVideo, MessageSquare } from "lucide-react";

export type ActiveCreatorData = {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
  bio: string | null;
  industryRole: string | null;
  _count: { posts: number; works: number };
};

export function ActiveCreatorList({
  creators,
}: {
  creators: ActiveCreatorData[];
}) {
  if (creators.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">活跃创作者</h2>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {creators.map((user) => (
          <Link
            key={user.id}
            href={`/profile/${user.id}`}
            className="group surface-card surface-card-hover flex items-center gap-3 p-3 transition-all hover:-translate-y-0.5"
          >
            {user.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatar}
                alt={user.name}
                className="size-10 shrink-0 rounded-full border border-border/60"
              />
            ) : (
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-foreground">
                {user.name.slice(0, 1)}
              </span>
            )}

            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold group-hover:text-primary">
                {user.name}
              </div>
              {user.industryRole && (
                <div className="truncate text-[11px] text-muted-foreground">
                  {user.industryRole}
                </div>
              )}
              <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground tabular-nums">
                <span className="inline-flex items-center gap-1">
                  <MessageSquare className="size-3" />
                  {user._count.posts} 帖
                </span>
                <span className="inline-flex items-center gap-1">
                  <FileVideo className="size-3" />
                  {user._count.works} 作品
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
