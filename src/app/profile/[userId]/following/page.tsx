import { notFound } from "next/navigation";
import { UserPlus } from "lucide-react";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { listFollowing } from "@/lib/follows/queries";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { UserList } from "@/components/follows/user-list";

export const dynamic = "force-dynamic";

export default async function FollowingPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, username: true },
  });
  if (!user) notFound();

  const session = await getSession();
  const viewerId = session?.userId ?? null;

  const result = await listFollowing({
    userId,
    viewerId,
    pageSize: 30,
  });

  const loginNext = `/profile/${userId}/following`;

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        eyebrow={`@${user.username}`}
        title={`${user.name} 关注的人`}
        description="这位创作者关注的所有用户。"
      />
      <div className="px-4 py-5 sm:px-8 sm:py-6">
        {result.items.length === 0 ? (
          <EmptyState
            icon={UserPlus}
            title="还没有关注任何人"
            description="去发现感兴趣的创作者吧。"
          />
        ) : (
          <UserList
            endpoint={`/api/users/${userId}/following`}
            initialItems={result.items}
            initialCursor={result.nextCursor}
            initialHasMore={result.hasMore}
            signedIn={!!session}
            viewerId={viewerId}
            loginNext={loginNext}
          />
        )}
      </div>
    </div>
  );
}
