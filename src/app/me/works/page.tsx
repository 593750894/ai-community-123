import Link from "next/link";
import { Film, Upload } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { WorkCard } from "@/components/feed/work-card";
import { requireUser } from "@/lib/auth/guard";
import { getMyWorks } from "@/lib/me/queries";
import { loadInteractionState } from "@/lib/interactions/queries";
import { MePager } from "../_components/me-pager";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

export default async function MyWorksPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireUser("/me/works");
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const { items, total } = await getMyWorks({
    userId: user.id,
    page,
    pageSize: PAGE_SIZE,
  });

  const interactions = await loadInteractionState({
    workIds: items.map((w) => w.id),
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        eyebrow="我的作品"
        title="我发布的所有作品"
        description={`共 ${total} 个作品，包括未公开作品。`}
        actions={
          <Button
            size="sm"
            nativeButton={false}
            render={<Link href="/create-work" />}
          >
            <Upload className="size-3.5" />
            发布新作品
          </Button>
        }
      />

      <div className="space-y-5 px-4 py-5 sm:px-8 sm:py-6">
        {items.length === 0 ? (
          <EmptyState
            icon={Film}
            title="还没有作品"
            description="上传你的第一部 AI 视频作品，加入作品广场。"
            action={
              <Button
                size="sm"
                nativeButton={false}
                render={<Link href="/create-work" />}
              >
                <Upload className="size-3.5" />
                发布作品
              </Button>
            }
          />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3 2xl:grid-cols-4">
              {items.map((w) => (
                <WorkCard
                  key={w.id}
                  work={w}
                  signedIn
                  viewerId={user.id}
                  liked={interactions.likedWorkIds.has(w.id)}
                  bookmarked={interactions.bookmarkedWorkIds.has(w.id)}
                />
              ))}
            </div>
            <MePager
              basePath="/me/works"
              page={page}
              totalPages={totalPages}
            />
          </>
        )}
      </div>
    </>
  );
}
