import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, BellOff, Settings2, UserRound, Users } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { MessageComposer } from "@/components/feed/message-composer";
import { MessageBubble } from "@/components/messages/message-bubble";
import { ConversationRealtime } from "@/components/messages/conversation-realtime";
import { MuteToggle } from "@/components/messages/mute-toggle";
import { getSession } from "@/lib/auth/session";
import {
  getConversationForUser,
  markConversationRead,
} from "@/lib/messages/queries";

export const dynamic = "force-dynamic";

const DATE_FMT = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function mutedUntilHours(mutedUntil: Date | null): number {
  if (!mutedUntil) return 0;
  const diffMs = mutedUntil.getTime() - Date.now();
  if (diffMs <= 0) return 0;
  return Math.max(1, Math.ceil(diffMs / 3600_000));
}

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  const session = await getSession();
  if (!session) {
    redirect(
      `/auth/login?next=${encodeURIComponent(`/messages/${conversationId}`)}`,
    );
  }

  const detail = await getConversationForUser(conversationId, session.userId);
  if (!detail) notFound();

  // 打开会话即标记已读
  await markConversationRead(conversationId, session.userId);

  const isGroup = detail.isGroup;
  const other = detail.otherUser;

  // 构建发件人查找映射，便于群聊消息渲染时显示对方姓名 / 头像
  const senderMap = new Map(
    detail.participants.map((p) => [p.user.id, p.user]),
  );
  // sender → 角色映射，决定 admin 是否能强删该消息
  const senderRoleMap = new Map(
    detail.participants.map((p) => [p.user.id, p.role]),
  );
  const me = detail.participants.find((p) => p.user.id === session.userId);
  const isMuted = me?.mutedUntil != null && me.mutedUntil > new Date();

  const headerTitle = isGroup
    ? (detail.title ?? "未命名群聊")
    : (other?.name ?? "未知用户");
  const headerDescription = isGroup
    ? `${detail.participants.length} 位成员 · ${
        detail.viewerRole === "OWNER"
          ? "你是群主"
          : detail.viewerRole === "ADMIN"
            ? "你是管理员"
            : "群聊"
      }`
    : other?.industryRole
      ? `@${other.username} · ${other.industryRole}`
      : other
        ? `@${other.username}`
        : undefined;

  return (
    <div className="flex flex-1 flex-col">
      <ConversationRealtime conversationId={conversationId} />
      <PageHeader
        eyebrow={isGroup ? "群聊" : "私信"}
        title={headerTitle}
        description={headerDescription}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/messages" />}
            >
              <ArrowLeft className="size-3.5" />
              返回列表
            </Button>
            <MuteToggle
              conversationId={conversationId}
              isMuted={isMuted}
              mutedHours={mutedUntilHours(me?.mutedUntil ?? null)}
            />
            {isGroup ? (
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href={`/messages/${conversationId}/settings`} />}
              >
                <Settings2 className="size-3.5" />
                群聊设置
              </Button>
            ) : (
              other && (
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<Link href={`/profile/${other.id}`} />}
                >
                  <UserRound className="size-3.5" />
                  查看主页
                </Button>
              )
            )}
          </div>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col px-6 pb-4 sm:px-8">
        <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-border bg-card/20">
          {isMuted && (
            <div className="flex items-center gap-2 border-b border-border bg-amber-500/5 px-5 py-2 text-xs text-amber-300">
              <BellOff className="size-3.5" />
              <span>
                免打扰开启中 · 此会话不会推送通知，红点也不计入未读
              </span>
            </div>
          )}
          {isGroup && (
            <div className="flex items-center gap-2 border-b border-border px-5 py-2.5 text-xs text-muted-foreground">
              <Users className="size-3.5 text-emerald-300" />
              <span>
                群聊 · 群主 / 管理员 可以管理成员；点右上「群聊设置」修改信息或退群。可在消息内 @用户名 提醒对方。
              </span>
            </div>
          )}
          <div className="flex-1 space-y-3 overflow-y-auto p-5">
            {detail.messages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center text-xs text-muted-foreground">
                {isGroup
                  ? "这是一个新群聊。向大家打个招呼吧～"
                  : "这是一个新会话。说点什么打个招呼吧～"}
              </div>
            ) : (
              detail.messages.map((m, idx, list) => {
                const prev = list[idx - 1];
                const showDate =
                  !prev || !isSameDay(prev.createdAt, m.createdAt);
                const self = m.senderId === session.userId;
                const sender = senderMap.get(m.senderId) ?? null;
                const senderRole = senderRoleMap.get(m.senderId);

                return (
                  <div key={m.id} className="space-y-2">
                    {showDate && (
                      <div className="text-center text-[11px] text-muted-foreground">
                        {DATE_FMT.format(m.createdAt)}
                      </div>
                    )}
                    <MessageBubble
                      conversationId={detail.id}
                      messageId={m.id}
                      senderId={m.senderId}
                      content={m.content}
                      type={m.type}
                      attachments={m.attachments}
                      createdAt={m.createdAt}
                      editedAt={m.editedAt}
                      deletedAt={m.deletedAt}
                      self={self}
                      sender={sender}
                      isGroup={isGroup}
                      viewerRole={detail.viewerRole}
                      senderRole={senderRole}
                    />
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-border p-3">
            <MessageComposer conversationId={detail.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
