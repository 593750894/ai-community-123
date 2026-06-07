import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, LogOut, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ConfirmForm } from "@/components/admin/confirm-form";
import { GroupSettingsForm } from "@/components/messages/group-settings-form";
import { GroupAddMembersForm } from "@/components/messages/group-add-members-form";
import { GroupMemberList } from "@/components/messages/group-member-list";
import { getSession } from "@/lib/auth/session";
import { getConversationForUser } from "@/lib/messages/queries";
import {
  deleteGroupConversationAction,
  leaveGroupConversationAction,
} from "@/lib/messages/group-actions";

export const dynamic = "force-dynamic";

export default async function GroupSettingsPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  const session = await getSession();
  if (!session) {
    redirect(
      `/auth/login?next=${encodeURIComponent(`/messages/${conversationId}/settings`)}`,
    );
  }
  const detail = await getConversationForUser(conversationId, session.userId);
  if (!detail) notFound();
  // 1v1 没有设置面板：跳回详情页
  if (!detail.isGroup) {
    redirect(`/messages/${conversationId}`);
  }

  const canEditInfo =
    detail.viewerRole === "OWNER" || detail.viewerRole === "ADMIN";
  const canAddMembers = canEditInfo;
  const isOwner = detail.viewerRole === "OWNER";

  const members = detail.participants.map((p) => ({
    user: p.user,
    role: p.role,
    joinedAt: p.joinedAt,
  }));

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        eyebrow="群聊设置"
        title={detail.title ?? "未命名群聊"}
        description={`${detail.participants.length} 位成员 · ${
          detail.viewerRole === "OWNER"
            ? "你是群主"
            : detail.viewerRole === "ADMIN"
              ? "你是管理员"
              : "你是成员"
        }`}
        actions={
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`/messages/${conversationId}`} />}
          >
            <ArrowLeft className="size-3.5" />
            返回会话
          </Button>
        }
      />

      <div className="space-y-6 px-4 py-5 sm:px-8 sm:py-6">
        <section className="space-y-3 rounded-2xl border border-border/60 bg-card/30 p-5">
          <h2 className="text-sm font-semibold">基础信息</h2>
          <p className="text-xs text-muted-foreground">
            {canEditInfo
              ? "群主和管理员可以修改群名与群头像。"
              : "仅群主和管理员可以修改群信息。"}
          </p>
          <GroupSettingsForm
            conversationId={conversationId}
            initialTitle={detail.title ?? ""}
            initialAvatarUrl={detail.avatarUrl}
            readOnly={!canEditInfo}
          />
        </section>

        {canAddMembers && (
          <section className="space-y-3 rounded-2xl border border-border/60 bg-card/30 p-5">
            <h2 className="text-sm font-semibold">添加成员</h2>
            <p className="text-xs text-muted-foreground">
              输入对方用户名（@username），可换行或逗号分隔批量添加。已在群内的会被跳过。
            </p>
            <GroupAddMembersForm conversationId={conversationId} />
          </section>
        )}

        <section className="space-y-3 rounded-2xl border border-border/60 bg-card/30 p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold">
              成员列表 · {detail.participants.length} 人
            </h2>
            <span className="text-[11px] text-muted-foreground">
              上限 {detail.memberLimit} 人
            </span>
          </div>
          <GroupMemberList
            conversationId={conversationId}
            members={members}
            viewerId={session.userId}
            viewerRole={detail.viewerRole}
          />
        </section>

        <section className="space-y-3 rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5">
          <h2 className="text-sm font-semibold text-rose-300">危险操作</h2>
          {isOwner ? (
            <>
              <p className="text-xs text-muted-foreground">
                解散后将清空所有成员与历史消息，无法恢复。
              </p>
              <ConfirmForm
                action={deleteGroupConversationAction}
                message={`确认解散群聊「${detail.title ?? "未命名"}」？此操作不可恢复。`}
              >
                <input
                  type="hidden"
                  name="conversationId"
                  value={conversationId}
                />
                <button
                  type="submit"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 text-sm font-medium text-rose-300 transition-colors hover:bg-rose-500/20"
                >
                  <Trash2 className="size-4" />
                  解散群聊
                </button>
              </ConfirmForm>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                退出后将无法看到后续消息；如需重新加入需由群主或管理员再次邀请。
              </p>
              <ConfirmForm
                action={leaveGroupConversationAction}
                message="确认退出该群聊？"
              >
                <input
                  type="hidden"
                  name="conversationId"
                  value={conversationId}
                />
                <button
                  type="submit"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 text-sm font-medium text-rose-300 transition-colors hover:bg-rose-500/20"
                >
                  <LogOut className="size-4" />
                  退出群聊
                </button>
              </ConfirmForm>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
