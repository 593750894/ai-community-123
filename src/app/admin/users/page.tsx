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
  ADMIN_STATUS_VALUES,
  ROLE_LABEL,
  STATUS_LABEL,
} from "@/lib/admin/users-meta";
import { ConfirmForm } from "@/components/admin/confirm-form";

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
                            <form
                              action={adminSetUserStatus}
                              className="flex items-center gap-1"
                            >
                              <input type="hidden" name="userId" value={u.id} />
                              <select
                                name="status"
                                defaultValue={u.status}
                                aria-label="设置状态"
                                className="h-6 rounded border border-border bg-background/60 px-1 text-[11px]"
                              >
                                {ADMIN_STATUS_VALUES.map((s) => (
                                  <option key={s} value={s}>
                                    {STATUS_LABEL[s]}
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
                            <ConfirmForm
                              action={adminForceLogoutUser}
                              message={`确认要强制 @${u.username} 下线吗？所有该用户已签发的会话立即失效。`}
                            >
                              <input type="hidden" name="userId" value={u.id} />
                              <button
                                type="submit"
                                className="rounded border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[11px] text-rose-300 hover:bg-rose-500/20"
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
