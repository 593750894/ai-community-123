import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// 阶段 11：用户列表。MVP 只做"查看 + 角色展示"，不做封禁 / 改密 / 改角色。
// 改角色这种事直接在 DB 里改即可，前端先不暴露入口。

const ROLE_LABEL: Record<string, string> = {
  USER: "普通用户",
  MOD: "版主",
  ADMIN: "管理员",
};

const ROLE_TONE: Record<string, string> = {
  USER: "bg-muted/60 text-muted-foreground",
  MOD: "bg-sky-500/15 text-sky-300",
  ADMIN: "bg-amber-500/15 text-amber-300",
};

export default async function AdminUsersPage() {
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
      createdAt: true,
      _count: { select: { posts: true, works: true } },
    },
  });

  return (
    <>
      <PageHeader
        eyebrow="管理后台"
        title="用户管理"
        description={`共 ${users.length} 位用户（最多展示最近 200 位）。角色在数据库中维护。`}
      />

      <div className="px-6 py-6 sm:px-8">
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card/40">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">用户</th>
                <th className="px-4 py-2.5 text-left font-medium">邮箱</th>
                <th className="px-4 py-2.5 text-left font-medium">角色</th>
                <th className="px-4 py-2.5 text-right font-medium">帖子</th>
                <th className="px-4 py-2.5 text-right font-medium">作品</th>
                <th className="px-4 py-2.5 text-left font-medium">注册</th>
                <th className="px-4 py-2.5 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-muted/20">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      {u.avatar && (
                        // 用 img 是有意的：avatar 来自 dicebear 等外部源，next/image 还要配 remotePatterns
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={u.avatar}
                          alt={u.username}
                          className="size-7 rounded-full border border-border/60 bg-muted"
                        />
                      )}
                      <div className="min-w-0">
                        <div className="truncate font-medium">{u.name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          @{u.username}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {u.email}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] ${ROLE_TONE[u.role] ?? "bg-muted/60"}`}
                    >
                      {ROLE_LABEL[u.role] ?? u.role}
                    </span>
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
                  <td className="px-4 py-2.5 text-right">
                    <Link
                      href={`/profile/${u.id}`}
                      className="text-xs text-primary hover:underline"
                    >
                      查看主页
                    </Link>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
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
