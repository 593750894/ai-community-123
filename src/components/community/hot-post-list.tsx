import Link from "next/link";
import { Flame, Heart, MessageCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";

export type HotPostData = {
  id: string;
  title: string;
  likeCount: number;
  commentCount: number;
  bookmarkCount: number;
  channel?: {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
    color: string;
  };
};

function hotScore(p: HotPostData) {
  return p.likeCount + p.commentCount * 2 + p.bookmarkCount;
}

const rankStyle = [
  "bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-sm shadow-amber-500/30",
  "bg-gradient-to-br from-slate-400 to-slate-500 text-white shadow-sm shadow-slate-400/30",
  "bg-gradient-to-br from-amber-700 to-amber-800 text-white shadow-sm shadow-amber-700/30",
] as const;

export function HotPostList({ posts }: { posts: HotPostData[] }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="inline-flex items-center gap-1.5 text-base font-semibold">
          <Flame className="size-4 text-orange-400" />
          热门帖子
        </h2>
        <Link
          href="/community"
          className="text-xs text-muted-foreground transition-colors hover:text-primary"
        >
          更多
        </Link>
      </div>

      {posts.length === 0 ? (
        <EmptyState
          icon={Flame}
          title="暂无热门帖子"
          description="近 7 天内还没有高互动帖子"
        />
      ) : (
        <div className="surface-card divide-y divide-border/40">
          {posts.map((post, i) => (
            <div
              key={post.id}
              className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/30"
            >
              <span
                className={cn(
                  "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-bold tabular-nums",
                  i < 3
                    ? rankStyle[i]
                    : "bg-muted text-muted-foreground",
                )}
              >
                {i + 1}
              </span>

              <div className="min-w-0 flex-1">
                <Link
                  href={`/post/${post.id}`}
                  className="line-clamp-1 text-sm font-medium leading-snug text-foreground/95 group-hover:text-primary"
                >
                  {post.title}
                </Link>

                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  {post.channel && (
                    <Link
                      href={`/community/${post.channel.id}`}
                      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 transition-colors hover:bg-muted"
                      style={{
                        backgroundColor: `${post.channel.color}15`,
                        color: post.channel.color,
                      }}
                    >
                      {post.channel.icon && (
                        <span className="text-[10px]">{post.channel.icon}</span>
                      )}
                      {post.channel.name}
                    </Link>
                  )}
                  <span className="inline-flex items-center gap-0.5 tabular-nums">
                    <Heart className="size-3" />
                    {post.likeCount}
                  </span>
                  <span className="inline-flex items-center gap-0.5 tabular-nums">
                    <MessageCircle className="size-3" />
                    {post.commentCount}
                  </span>
                </div>
              </div>

              <span className="mt-1 shrink-0 rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-orange-500">
                {hotScore(post)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
