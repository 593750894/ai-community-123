import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageSquare, Plus, Users } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getSession } from "@/lib/auth/session";
import { listConversationsForUser } from "@/lib/messages/queries";
import { formatRelativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const session = await getSession();
  if (!session) {
    redirect(`/auth/login?next=${encodeURIComponent("/messages")}`);
  }

  const conversations = await listConversationsForUser(session.userId);

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        eyebrow="消息中心"
        title="Messages"
        description="与其他创作者的一对一私信或群聊。MVP 阶段消息发送后需手动刷新或重新进入会话查看对方回复。"
        actions={
          <Button
            variant="default"
            size="sm"
            nativeButton={false}
            render={<Link href="/messages/new" />}
          >
            <Plus className="size-3.5" />
            新建群聊
          </Button>
        }
      />

      <div className="px-4 py-5 sm:px-8 sm:py-6">
        {conversations.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="还没有私信"
            description={
              <>
                可以去
                <Link
                  href="/showcase"
                  className="mx-1 text-primary hover:underline"
                >
                  作品广场
                </Link>
                或
                <Link
                  href="/collaboration"
                  className="mx-1 text-primary hover:underline"
                >
                  项目合作
                </Link>
                发现感兴趣的创作者，从他们的主页发起对话；也可
                <Link
                  href="/messages/new"
                  className="mx-1 text-primary hover:underline"
                >
                  新建群聊
                </Link>
                邀请多人讨论。
              </>
            }
          />
        ) : (
          <ul className="divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/60 bg-card/30">
            {conversations.map((c) => {
              const other = c.otherUser;
              const isGroup = c.isGroup;
              const displayName = isGroup
                ? (c.title ?? "未命名群聊")
                : (other?.name ?? "未知用户");
              const initials = displayName.slice(0, 1);
              const avatar = isGroup ? c.avatarUrl : (other?.avatar ?? null);
              const subLabel = isGroup
                ? `${c.participantCount} 位成员`
                : (other?.industryRole ?? null);
              const preview = c.lastMessage
                ? c.lastMessage.deletedAt
                  ? "（消息已删除）"
                  : c.lastMessage.senderId === session.userId
                    ? `你: ${c.lastMessage.content}`
                    : c.lastMessage.content
                : "暂无消息";
              return (
                <li key={c.id}>
                  <Link
                    href={`/messages/${c.id}`}
                    className="flex w-full items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30"
                  >
                    <div className="relative shrink-0">
                      {avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={avatar}
                          alt={displayName}
                          className="size-11 rounded-full border border-border/60 object-cover"
                        />
                      ) : (
                        <span
                          className={`flex size-11 items-center justify-center rounded-full text-sm font-semibold text-black/70 ${
                            isGroup
                              ? "bg-gradient-to-br from-emerald-300 to-teal-500"
                              : "bg-gradient-to-br from-indigo-300 to-purple-500"
                          }`}
                        >
                          {initials}
                        </span>
                      )}
                      {isGroup && (
                        <span className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full border border-border bg-card text-[10px] text-emerald-300">
                          <Users className="size-2.5" />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {displayName}
                        </span>
                        {subLabel && (
                          <span className="hidden truncate rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary sm:inline">
                            {subLabel}
                          </span>
                        )}
                        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground tabular-nums">
                          {formatRelativeTime(c.lastMessageAt)}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className="line-clamp-1 flex-1 text-xs text-muted-foreground">
                          {preview}
                        </span>
                        {c.unreadCount > 0 && (
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                            {c.unreadCount > 99 ? "99+" : c.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
