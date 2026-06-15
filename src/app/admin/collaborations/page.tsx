import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { requireAdmin } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import {
  adminDeleteCollab,
  adminUpdateCollabStatus,
} from "@/lib/admin/actions";
import {
  COLLAB_STATUS_LABEL,
  COLLAB_STATUS_TINT,
  COLLAB_STATUS_VALUES,
  collabCategoryMeta,
  COLLAB_TYPE_LABEL,
  type CollabStatusValue,
  type CollabTypeValue,
} from "@/lib/collaborations/categories";
import { pillTagTintClass } from "@/components/ui/pill-tag";

export const dynamic = "force-dynamic";

// 阶段 11：合作需求管理。
// 普通用户只能改自己发的，管理员这里可以改任何一条 + 直接删。
// 状态切换走 select.onChange → form submit（无 JS：select + 提交按钮）。

export default async function AdminCollaborationsPage() {
  await requireAdmin("/admin/collaborations");
  const collabs = await prisma.collaboration.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      title: true,
      type: true,
      category: true,
      status: true,
      budget: true,
      createdAt: true,
      author: { select: { id: true, name: true, username: true } },
    },
  });

  return (
    <>
      <PageHeader
        eyebrow="管理后台"
        title="合作需求管理"
        description={`共 ${collabs.length} 条。可直接修改状态或删除。`}
      />

      <div className="px-6 py-6 sm:px-8">
        <div className="overflow-hidden rounded-xl border border-border bg-card/40">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">标题</th>
                <th className="px-4 py-2.5 text-left font-medium">类型</th>
                <th className="px-4 py-2.5 text-left font-medium">分类</th>
                <th className="px-4 py-2.5 text-left font-medium">作者</th>
                <th className="px-4 py-2.5 text-left font-medium">预算</th>
                <th className="px-4 py-2.5 text-left font-medium">状态</th>
                <th className="px-4 py-2.5 text-left font-medium">发布</th>
                <th className="px-4 py-2.5 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {collabs.map((c) => {
                const meta = collabCategoryMeta(c.category);
                return (
                  <tr key={c.id} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/collaboration/${c.id}`}
                        className="font-medium hover:text-primary"
                      >
                        <span className="line-clamp-1">{c.title}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {COLLAB_TYPE_LABEL[c.type as CollabTypeValue] ?? c.type}
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      <span className="inline-flex items-center gap-1">
                        <meta.icon className="size-3.5 text-muted-foreground" aria-hidden />
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      <Link
                        href={`/profile/${c.author.id}`}
                        className="hover:text-primary"
                      >
                        {c.author.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {c.budget ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <form
                        action={adminUpdateCollabStatus}
                        className="flex items-center gap-1.5"
                      >
                        <input type="hidden" name="id" value={c.id} />
                        <select
                          name="status"
                          defaultValue={c.status}
                          className={`rounded-md border border-border px-1.5 py-0.5 text-[11px] outline-none focus:border-primary/50 ${pillTagTintClass(COLLAB_STATUS_TINT[c.status as CollabStatusValue])}`}
                        >
                          {COLLAB_STATUS_VALUES.map((s) => (
                            <option key={s} value={s}>
                              {COLLAB_STATUS_LABEL[s]}
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          className="rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                        >
                          保存
                        </button>
                      </form>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {c.createdAt.toISOString().slice(0, 10)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <form action={adminDeleteCollab}>
                        <input type="hidden" name="id" value={c.id} />
                        <button
                          type="submit"
                          className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs text-destructive transition-colors hover:bg-destructive/20"
                        >
                          删除
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
              {collabs.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    还没有合作需求
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
