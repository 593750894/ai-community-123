import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { prisma } from "@/lib/db";
import { adminDeletePost } from "@/lib/admin/actions";

export const dynamic = "force-dynamic";

// 阶段 11：帖子管理。只做"看 + 删"。
// 改帖子内容、置顶/锁帖等编辑能力 MVP 不做。

export default async function AdminPostsPage() {
  const posts = await prisma.post.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      title: true,
      type: true,
      views: true,
      likeCount: true,
      commentCount: true,
      createdAt: true,
      channel: { select: { slug: true, name: true } },
      author: { select: { id: true, username: true, name: true } },
    },
  });

  return (
    <>
      <PageHeader
        eyebrow="管理后台"
        title="帖子管理"
        description={`最近 ${posts.length} 条帖子。点击删除可移除违规内容（评论 / 点赞 / 收藏将级联删除）。`}
      />

      <div className="px-6 py-6 sm:px-8">
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card/40">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">标题</th>
                <th className="px-4 py-2.5 text-left font-medium">频道</th>
                <th className="px-4 py-2.5 text-left font-medium">作者</th>
                <th className="px-4 py-2.5 text-right font-medium">浏览</th>
                <th className="px-4 py-2.5 text-right font-medium">赞</th>
                <th className="px-4 py-2.5 text-right font-medium">评</th>
                <th className="px-4 py-2.5 text-left font-medium">发布</th>
                <th className="px-4 py-2.5 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {posts.map((p) => (
                <tr key={p.id} className="hover:bg-muted/20">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/community/${p.channel.slug}#post-${p.id}`}
                      className="font-medium hover:text-primary"
                    >
                      <span className="line-clamp-1">{p.title}</span>
                    </Link>
                    <span className="mt-0.5 inline-block rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {p.type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {p.channel.name}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    <Link
                      href={`/profile/${p.author.id}`}
                      className="hover:text-primary"
                    >
                      {p.author.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {p.views}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {p.likeCount}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {p.commentCount}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {p.createdAt.toISOString().slice(0, 10)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <form action={adminDeletePost}>
                      <input type="hidden" name="id" value={p.id} />
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
              {posts.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    还没有帖子
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
