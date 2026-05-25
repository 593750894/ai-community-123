import Link from "next/link";

import { PostCard, type PostCardData } from "@/components/feed/post-card";
import { EmptyState } from "@/components/ui/empty-state";
import { MessageSquare } from "lucide-react";

export function LatestDiscussionList({ posts }: { posts: PostCardData[] }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">最新讨论</h2>
        <Link
          href="/community"
          className="text-xs text-muted-foreground transition-colors hover:text-primary"
        >
          更多
        </Link>
      </div>

      {posts.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="暂无讨论"
          description="成为第一个发起讨论的人吧"
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} showChannel />
          ))}
        </div>
      )}
    </section>
  );
}
