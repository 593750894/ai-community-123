import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { PillTag, type PillTagTint } from "@/components/ui/pill-tag";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guard";
import {
  adminForceLogoutUser,
  adminSetUserRole,
  adminSetUserStatus,
} from "@/lib/admin/users";
import {
  ADMIN_ROLE_VALUES,
  ROLE_LABEL,
  STATUS_LABEL,
} from "@/lib/admin/users-meta";
import { ConfirmForm } from "@/components/admin/confirm-form";
import { SuspendUserDialog } from "@/components/admin/suspend-user-dialog";

export const dynamic = "force-dynamic";

// Stage 9：用户管理。每行可改角色、改状态、强制下线。
// 操作自己被服务端阻断（adminSet* 会校验 userId !== admin.id）。

const ROLE_TINT: Record<string, PillTagTint> = {
  USER: "slate",
  MOD: "cyan",
  ADMIN: "amber",
};

const STATUS_TINT: Record<string, PillTagTint> = {
  ACTIVE: "emerald",
  SUSPENDED: "amber",
  BANNED: "rose",
  DELETED: "slate",
};

export default async function AdminUsersPage() {
  const admin = await requireAdmin("/admin/users");
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      username: true,
      name: true,
      email: true,
      avatar: true,
      role: true,
      status: true,
      suspendedUntil: true,
      suspensionReason: true,
      createdAt: true,
      _count: { select: { posts: true, works: true } },
    },
  });

  return (
    <>
      <PageHeader
        eyebrow="管理后台"
        title="用户管理"
        description={`共 ${users.length} 位用户（最多展示最近 200 位）。角色 / 状态 / 强制下线均可操作；自己不可改自己。`}
      />

      <div className="px-6 py-6 sm:px-8">
        <div className="overflow-hidden rounded-xl border border-border bg-card/40">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">用户</th>
                <th className="px-4 py-2.5 text-left font-medium">邮箱</th>
                <th className="px-4 py-2.5 text-left font-medium">角色</th>
                <th className="px-4 py-2.5 text-left font-medium">状态</th>
                <th className="px-4 py-2.5 text-right font-medium">帖子</th>
                <th className="px-4 py-2.5 text-right font-medium">作品</th>
                <th className="px-4 py-2.5 text-left font-medium">注册</th>
                <th className="px-4 py-2.5 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => {
                const isSelf = u.id === admin.id;
                return (
                  <tr key={u.id} className="align-top hover:bg-muted/20">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        {u.avatar && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={u.avatar}
                            alt={u.username}
                            className="size-7 rounded-full border border-border bg-muted"
                          />
                        )}
                        <div className="min-w-0">
                          <div className="truncate font-medium">{u.name}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            @{u.username}
                            {isSelf && (
                              <span className="ml-1 rounded bg-primary/15 px-1 text-[10px] text-primary">
                                你
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {u.email}
                    </td>
                    <td className="px-4 py-2.5">
                      <PillTag tint={ROLE_TINT[u.role] ?? "slate"} icon={null} size="sm">
                        {ROLE_LABEL[u.role] ?? u.role}
                      </PillTag>
                    </td>
                    <td className="px-4 py-2.5">
                      <PillTag tint={STATUS_TINT[u.status] ?? "slate"} icon={null} size="sm">
                        {STATUS_LABEL[u.status] ?? u.status}
                      </PillTag>
                      {u.status === "SUSPENDED" && (
                        <div className="mt-1.5 max-w-[16ch] space-y-0.5 text-[10px] text-muted-foreground">
                          {u.suspendedUntil ? (
                            <div>
                              至 {u.suspendedUntil.toISOString().slice(0, 16).replace("T", " ")}
                            </div>
                          ) : (
                            <div className="text-tag-amber-fg">永久</div>
                          )}
                          {u.suspensionReason && (
                            <div className="truncate" title={u.suspensionReason}>
                              {u.suspensionReason}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {u._count.posts}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {u._count.works}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {u.createdAt.toISOString().slice(0, 10)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col items-end gap-1.5">
                        <Link
                          href={`/profile/${u.id}`}
                          className="text-[11px] text-primary hover:underline"
                        >
                          查看主页
                        </Link>
                        {!isSelf && u.status !== "DELETED" && (
                          <>
                            <form
                              action={adminSetUserRole}
                              className="flex items-center gap-1"
                            >
                              <input type="hidden" name="userId" value={u.id} />
                              <select
                                name="role"
                                defaultValue={u.role}
                                aria-label="设置角色"
                                className="h-6 rounded border border-border bg-background/60 px-1 text-[11px]"
                              >
                                {ADMIN_ROLE_VALUES.map((r) => (
                                  <option key={r} value={r}>
                                    {ROLE_LABEL[r]}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="submit"
                                className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                              >
                                保存
                              </button>
                            </form>
                            {/* Stage 17.5：用 dialog 收集禁言原因 + 期限，不再用裸 select */}
                            <div className="flex flex-wrap items-center justify-end gap-1">
                              {u.status === "ACTIVE" && (
                                <SuspendUserDialog
                                  userId={u.id}
                                  username={u.username}
                                />
                              )}
                              {u.status === "SUSPENDED" && (
                                <>
                                  <SuspendUserDialog
                                    userId={u.id}
                                    username={u.username}
                                    alreadySuspended
                                  />
                                  <ConfirmForm
                                    action={adminSetUserStatus}
                                    message={`确认解除对 @${u.username} 的禁言？`}
                                  >
                                    <input type="hidden" name="userId" value={u.id} />
                                    <input type="hidden" name="status" value="ACTIVE" />
                                    <button
                                      type="submit"
                                      className="rounded-full border border-tag-emerald-bg bg-tag-emerald-bg/60 px-2 py-0.5 text-[11px] font-medium text-tag-emerald-fg hover:bg-tag-emerald-bg"
                                    >
                                      解除禁言
                                    </button>
                                  </ConfirmForm>
                                </>
                              )}
                              {u.status !== "BANNED" && (
                                <ConfirmForm
                                  action={adminSetUserStatus}
                                  message={`确认封禁 @${u.username}？账户进入终态，无法登录，不可一键还原。`}
                                >
                                  <input type="hidden" name="userId" value={u.id} />
                                  <input type="hidden" name="status" value="BANNED" />
                                  <button
                                    type="submit"
                                    className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive hover:bg-destructive/20"
                                  >
                                    封禁
                                  </button>
                                </ConfirmForm>
                              )}
                              {u.status === "BANNED" && (
                                <ConfirmForm
                                  action={adminSetUserStatus}
                                  message={`确认解封 @${u.username}？账户恢复 ACTIVE 状态。`}
                                >
                                  <input type="hidden" name="userId" value={u.id} />
                                  <input type="hidden" name="status" value="ACTIVE" />
                                  <button
                                    type="submit"
                                    className="rounded-full border border-tag-emerald-bg bg-tag-emerald-bg/60 px-2 py-0.5 text-[11px] font-medium text-tag-emerald-fg hover:bg-tag-emerald-bg"
                                  >
                                    解封
                                  </button>
                                </ConfirmForm>
                              )}
                            </div>
                            <ConfirmForm
                              action={adminForceLogoutUser}
                              message={`确认要强制 @${u.username} 下线吗？所有该用户已签发的会话立即失效。`}
                            >
                              <input type="hidden" name="userId" value={u.id} />
                              <button
                                type="submit"
                                className="rounded border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-[11px] text-destructive hover:bg-destructive/20"
                              >
                                强制下线
                              </button>
                            </ConfirmForm>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    还没有用户
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
