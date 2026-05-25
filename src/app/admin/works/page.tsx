import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { prisma } from "@/lib/db";
import { adminDeleteWork } from "@/lib/admin/actions";

export const dynamic = "force-dynamic";

// 阶段 11：作品管理。删除后点赞 / 收藏 cascade 一起删。

export default async function AdminWorksPage() {
  const works = await prisma.work.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      title: true,
      category: true,
      model: true,
      resolution: true,
      durationSec: true,
      views: true,
      likeCount: true,
      isPublic: true,
      createdAt: true,
      author: { select: { id: true, username: true, name: true } },
    },
  });

  return (
    <>
      <PageHeader
        eyebrow="管理后台"
        title="作品管理"
        description={`最近 ${works.length} 件作品。`}
      />

      <div className="px-6 py-6 sm:px-8">
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card/40">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">作品</th>
                <th className="px-4 py-2.5 text-left font-medium">作者</th>
                <th className="px-4 py-2.5 text-left font-medium">模型</th>
                <th className="px-4 py-2.5 text-left font-medium">规格</th>
                <th className="px-4 py-2.5 text-right font-medium">播放</th>
                <th className="px-4 py-2.5 text-right font-medium">赞</th>
                <th className="px-4 py-2.5 text-left font-medium">公开</th>
                <th className="px-4 py-2.5 text-left font-medium">发布</th>
                <th className="px-4 py-2.5 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {works.map((w) => (
                <tr key={w.id} className="hover:bg-muted/20">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/showcase/${w.id}`}
                      className="font-medium hover:text-primary"
                    >
                      <span className="line-clamp-1">{w.title}</span>
                    </Link>
                    <span className="mt-0.5 inline-block rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {w.category}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    <Link
                      href={`/profile/${w.author.id}`}
                      className="hover:text-primary"
                    >
                      {w.author.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {w.model}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {w.resolution ?? "—"}
                    {w.durationSec ? ` · ${w.durationSec}s` : ""}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {w.views}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {w.likeCount}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {w.isPublic ? (
                      <span className="text-emerald-300">是</span>
                    ) : (
                      <span className="text-muted-foreground">私密</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {w.createdAt.toISOString().slice(0, 10)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <form action={adminDeleteWork}>
                      <input type="hidden" name="id" value={w.id} />
                      <button
                        type="submit"
                        className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-xs text-rose-300 transition-colors hover:bg-rose-500/20"
                      >
                        删除
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {works.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    还没有作品
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
