import { redirect } from "next/navigation";
import { Bell } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { getSession } from "@/lib/auth/session";
import { listNotifications } from "@/lib/notifications/queries";

import { NotificationList } from "./notification-list";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await getSession();
  if (!session) {
    redirect(`/auth/login?next=${encodeURIComponent("/notifications")}`);
  }

  const { items, nextCursor, hasMore } = await listNotifications({
    userId: session.userId,
    pageSize: 30,
  });

  const unreadCount = items.filter((n) => !n.readAt).length;

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        eyebrow="通知"
        title="Notifications"
        description="互动反馈与系统消息会在这里聚合。点击任一条即跳转至来源并自动标记为已读。"
      />

      <div className="px-4 py-5 sm:px-8 sm:py-6">
        {items.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="目前还没有通知"
            description="当其他创作者点赞、评论或私信你时，相关消息会出现在这里。"
          />
        ) : (
          <NotificationList
            initialItems={items}
            initialCursor={nextCursor}
            initialHasMore={hasMore}
            initialUnreadCount={unreadCount}
          />
        )}
      </div>
    </div>
  );
}
