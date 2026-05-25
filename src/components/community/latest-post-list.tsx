import Link from "next/link";
import { MessageSquarePlus, PenLine } from "lucide-react";

import { PostCard, type PostCardData } from "@/components/feed/post-card";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineError } from "@/components/ui/error-state";

function publishHref(signedIn: boolean) {
  return signedIn ? "/create-post" : "/auth/login?next=/create-post";
}

export function LatestPostList({
  posts,
  signedIn = false,
  error = false,
}: {
  posts: PostCardData[];
  signedIn?: boolean;
  error?: boolean;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="inline-flex items-center gap-1.5 text-base font-semibold">
          <MessageSquarePlus className="size-4 text-blue-400" />
          最新讨论
        </h2>
        <div className="flex items-center gap-3">
          <Link
            href={publishHref(signedIn)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
          >
            <PenLine className="size-3" />
            发布讨论
          </Link>
          <Link
            href="/community"
            className="text-xs text-muted-foreground transition-colors hover:text-primary"
          >
            更多
          </Link>
        </div>
      </div>

      {error ? (
        <InlineError message="最新讨论加载失败，请稍后刷新重试" />
      ) : posts.length === 0 ? (
        <EmptyState
          icon={MessageSquarePlus}
          title="暂无讨论"
          description="成为第一个发起话题的人。"
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
