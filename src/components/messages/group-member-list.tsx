import Link from "next/link";
import { Crown, Shield, User as UserIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ConfirmForm } from "@/components/admin/confirm-form";
import type { ConversationRole } from "@/lib/messages/queries";
import {
  removeGroupMemberAction,
  updateGroupMemberRoleAction,
} from "@/lib/messages/group-actions";

export type GroupMember = {
  user: {
    id: string;
    name: string;
    username: string;
    avatar: string | null;
    industryRole: string | null;
  };
  role: ConversationRole;
  joinedAt: Date;
};

const ROLE_LABEL: Record<ConversationRole, string> = {
  OWNER: "群主",
  ADMIN: "管理员",
  MEMBER: "成员",
};

const ROLE_PRIORITY: Record<ConversationRole, number> = {
  OWNER: 0,
  ADMIN: 1,
  MEMBER: 2,
};

function RoleIcon({ role }: { role: ConversationRole }) {
  if (role === "OWNER") return <Crown className="size-3 text-amber-300" />;
  if (role === "ADMIN") return <Shield className="size-3 text-sky-300" />;
  return <UserIcon className="size-3 text-muted-foreground" />;
}

export function GroupMemberList({
  conversationId,
  members,
  viewerId,
  viewerRole,
}: {
  conversationId: string;
  members: GroupMember[];
  viewerId: string;
  viewerRole: ConversationRole;
}) {
  const sorted = [...members].sort((a, b) => {
    if (ROLE_PRIORITY[a.role] !== ROLE_PRIORITY[b.role]) {
      return ROLE_PRIORITY[a.role] - ROLE_PRIORITY[b.role];
    }
    return a.joinedAt.getTime() - b.joinedAt.getTime();
  });

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card/30">
      {sorted.map((m) => {
        const isSelf = m.user.id === viewerId;
        const canPromote =
          viewerRole === "OWNER" && !isSelf && m.role === "MEMBER";
        const canDemote =
          viewerRole === "OWNER" && !isSelf && m.role === "ADMIN";
        // OWNER 可踢任何非 OWNER；ADMIN 仅可踢 MEMBER；不可对自己使用「移除」
        const canRemove =
          !isSelf &&
          m.role !== "OWNER" &&
          ((viewerRole === "OWNER") ||
            (viewerRole === "ADMIN" && m.role === "MEMBER"));

        return (
          <li
            key={m.user.id}
            className="flex flex-wrap items-center gap-3 px-4 py-3"
          >
            <Link
              href={`/profile/${m.user.id}`}
              className="flex min-w-0 items-center gap-3 hover:opacity-90"
            >
              {m.user.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.user.avatar}
                  alt={m.user.name}
                  className="size-9 shrink-0 rounded-full border border-border object-cover"
                />
              ) : (
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                  {m.user.name.slice(0, 1)}
                </span>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <span className="truncate">{m.user.name}</span>
                  {isSelf && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      你
                    </span>
                  )}
                </div>
                <div className="truncate text-[11px] text-muted-foreground">
                  @{m.user.username}
                  {m.user.industryRole ? ` · ${m.user.industryRole}` : ""}
                </div>
              </div>
            </Link>

            <Badge
              variant="outline"
              className="ml-auto inline-flex items-center gap-1"
            >
              <RoleIcon role={m.role} />
              <span>{ROLE_LABEL[m.role]}</span>
            </Badge>

            {(canPromote || canDemote || canRemove) && (
              <div className="ml-auto flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:ml-0">
                {canPromote && (
                  <form action={updateGroupMemberRoleAction}>
                    <input
                      type="hidden"
                      name="conversationId"
                      value={conversationId}
                    />
                    <input type="hidden" name="userId" value={m.user.id} />
                    <input type="hidden" name="role" value="ADMIN" />
                    <button
                      type="submit"
                      className="rounded-full border border-sky-500/40 px-2.5 py-1 text-[11px] text-sky-300 transition-colors hover:bg-sky-500/10"
                    >
                      提为管理员
                    </button>
                  </form>
                )}
                {canDemote && (
                  <form action={updateGroupMemberRoleAction}>
                    <input
                      type="hidden"
                      name="conversationId"
                      value={conversationId}
                    />
                    <input type="hidden" name="userId" value={m.user.id} />
                    <input type="hidden" name="role" value="MEMBER" />
                    <button
                      type="submit"
                      className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted/50"
                    >
                      取消管理员
                    </button>
                  </form>
                )}
                {canRemove && (
                  <ConfirmForm
                    action={removeGroupMemberAction}
                    message={`确认移除 ${m.user.name}？`}
                  >
                    <input
                      type="hidden"
                      name="conversationId"
                      value={conversationId}
                    />
                    <input type="hidden" name="userId" value={m.user.id} />
                    <button
                      type="submit"
                      className="rounded-full border border-rose-500/40 px-2.5 py-1 text-[11px] text-rose-300 transition-colors hover:bg-rose-500/10"
                    >
                      移除
                    </button>
                  </ConfirmForm>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
