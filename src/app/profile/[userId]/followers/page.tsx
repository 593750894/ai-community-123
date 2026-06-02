import { notFound } from "next/navigation";
import { Users } from "lucide-react";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { listFollowers } from "@/lib/follows/queries";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { UserList } from "@/components/follows/user-list";

export const dynamic = "force-dynamic";

export default async function FollowersPage({
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

  const result = await listFollowers({
    userId,
    viewerId,
    pageSize: 30,
  });

  const loginNext = `/profile/${userId}/followers`;

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        eyebrow={`@${user.username}`}
        title={`${user.name} 的粉丝`}
        description="所有关注了这位创作者的用户。"
      />
      <div className="px-4 py-5 sm:px-8 sm:py-6">
        {result.items.length === 0 ? (
          <EmptyState
            icon={Users}
            title="还没有粉丝"
            description="一旦有人关注，他们会出现在这里。"
          />
        ) : (
          <UserList
            endpoint={`/api/users/${userId}/followers`}
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
