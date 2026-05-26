import Link from "next/link";
import { Flame, Heart, MessageCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import type { PostOverview } from "@/types/community";

function hotScore(p: PostOverview) {
  return p.likeCount + p.commentCount * 2 + p.bookmarkCount;
}

const rankStyle = [
  "bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-sm shadow-amber-500/30",
  "bg-gradient-to-br from-slate-400 to-slate-500 text-white shadow-sm shadow-slate-400/30",
  "bg-gradient-to-br from-amber-700 to-amber-800 text-white shadow-sm shadow-amber-700/30",
] as const;

export function ChannelHotPosts({ posts }: { posts: PostOverview[] }) {
  if (posts.length === 0) return null;

  return (
    <section className="space-y-3">
      <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold">
        <Flame className="size-3.5 text-orange-400" />
        频道热帖
      </h3>

      <div className="surface-card divide-y divide-border/30 overflow-hidden">
        {posts.map((post, i) => (
          <div
            key={post.id}
            className="group flex items-start gap-2.5 px-3.5 py-3 transition-colors hover:bg-muted/30"
          >
            <span
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded text-[10px] font-bold tabular-nums",
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
                className="line-clamp-2 text-xs font-medium leading-snug text-foreground/90 group-hover:text-primary"
              >
                {post.title}
              </Link>
              <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="inline-flex items-center gap-0.5 tabular-nums">
                  <Heart className="size-2.5" />
                  {post.likeCount}
                </span>
                <span className="inline-flex items-center gap-0.5 tabular-nums">
                  <MessageCircle className="size-2.5" />
                  {post.commentCount}
                </span>
                <span className="ml-auto rounded-full bg-orange-500/10 px-1.5 py-0.5 text-[9px] font-semibold tabular-nums text-orange-400">
                  {hotScore(post)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
