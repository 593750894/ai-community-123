import Link from "next/link";
import { Flame } from "lucide-react";

import { PostCard, type PostCardData } from "@/components/feed/post-card";
import { EmptyState } from "@/components/ui/empty-state";

export function HotPostList({ posts }: { posts: PostCardData[] }) {
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
        <div className="space-y-3">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} showChannel />
          ))}
        </div>
      )}
    </section>
  );
}
