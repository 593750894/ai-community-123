import Link from "next/link";
import { Bookmark, Compass } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PostCard } from "@/components/feed/post-card";
import { WorkCard } from "@/components/feed/work-card";
import { requireUser } from "@/lib/auth/guard";
import { getMyBookmarks } from "@/lib/me/queries";
import { loadInteractionState } from "@/lib/interactions/queries";
import { MePager } from "../_components/me-pager";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function MyBookmarksPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireUser("/me/bookmarks");
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const { items, total } = await getMyBookmarks({
    userId: user.id,
    page,
    pageSize: PAGE_SIZE,
  });

  const postIds = items.filter((i) => i.kind === "post").map((i) => i.post.id);
  const workIds = items.filter((i) => i.kind === "work").map((i) => i.work.id);
  const interactions = await loadInteractionState({ postIds, workIds });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        eyebrow="稍后再看"
        title="我收藏的内容"
        description={`共 ${total} 条收藏，混合显示帖子和作品，按收藏时间倒序。`}
      />

      <div className="space-y-5 px-4 py-5 sm:px-8 sm:py-6">
        {items.length === 0 ? (
          <EmptyState
            icon={Bookmark}
            title="还没有收藏任何内容"
            description="收藏让你随时回到喜欢的帖子和作品，去发现一些想保存的好内容吧。"
            action={
              <>
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<Link href="/community" />}
                >
                  <Compass className="size-3.5" />
                  逛社区
                </Button>
                <Button
                  size="sm"
                  nativeButton={false}
                  render={<Link href="/showcase" />}
                >
                  作品广场
                </Button>
              </>
            }
          />
        ) : (
          <>
            <BookmarkList
              items={items}
              viewerId={user.id}
              likedPostIds={interactions.likedPostIds}
              likedWorkIds={interactions.likedWorkIds}
              bookmarkedPostIds={interactions.bookmarkedPostIds}
              bookmarkedWorkIds={interactions.bookmarkedWorkIds}
            />
            <MePager
              basePath="/me/bookmarks"
              page={page}
              totalPages={totalPages}
            />
          </>
        )}
      </div>
    </>
  );
}

function BookmarkList({
  items,
  viewerId,
  likedPostIds,
  likedWorkIds,
  bookmarkedPostIds,
  bookmarkedWorkIds,
}: {
  items: Awaited<ReturnType<typeof getMyBookmarks>>["items"];
  viewerId: string;
  likedPostIds: Set<string>;
  likedWorkIds: Set<string>;
  bookmarkedPostIds: Set<string>;
  bookmarkedWorkIds: Set<string>;
}) {
  const works = items.filter((i): i is Extract<typeof items[number], { kind: "work" }> => i.kind === "work");
  const posts = items.filter((i): i is Extract<typeof items[number], { kind: "post" }> => i.kind === "post");

  return (
    <div className="space-y-6">
      {works.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">作品 · {works.length}</h2>
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3 2xl:grid-cols-4">
            {works.map((i) => (
              <WorkCard
                key={`w-${i.work.id}`}
                work={i.work}
                signedIn
                viewerId={viewerId}
                liked={likedWorkIds.has(i.work.id)}
                bookmarked={bookmarkedWorkIds.has(i.work.id)}
              />
            ))}
          </div>
        </section>
      )}
      {posts.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">帖子 · {posts.length}</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {posts.map((i) => (
              <PostCard
                key={`p-${i.post.id}`}
                post={i.post}
                showChannel
                signedIn
                viewerId={viewerId}
                liked={likedPostIds.has(i.post.id)}
                bookmarked={bookmarkedPostIds.has(i.post.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
