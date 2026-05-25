import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { CreateToolForm } from "@/components/admin/create-tool-form";
import { prisma } from "@/lib/db";
import { adminDeleteTool } from "@/lib/admin/actions";
import {
  TOOL_PRICING_LABEL,
  toolCategoryMeta,
  type ToolPricingValue,
} from "@/lib/tools/categories";

export const dynamic = "force-dynamic";

// 阶段 11：工具库管理。看 + 新增 + 删除。
// 修改工具属性 MVP 不做，要改先删再加。

export default async function AdminToolsPage() {
  const tools = await prisma.tool.findMany({
    orderBy: [{ isOfficial: "desc" }, { createdAt: "desc" }],
    take: 300,
    select: {
      id: true,
      slug: true,
      name: true,
      url: true,
      category: true,
      pricing: true,
      isOfficial: true,
      tags: true,
      createdAt: true,
      createdBy: { select: { id: true, name: true } },
    },
  });

  return (
    <>
      <PageHeader
        eyebrow="管理后台"
        title="工具库管理"
        description={`共 ${tools.length} 个工具。`}
      />

      <div className="space-y-6 px-6 py-6 sm:px-8">
        <CreateToolForm />

        <div className="overflow-hidden rounded-xl border border-border/60 bg-card/40">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">工具</th>
                <th className="px-4 py-2.5 text-left font-medium">分类</th>
                <th className="px-4 py-2.5 text-left font-medium">计费</th>
                <th className="px-4 py-2.5 text-left font-medium">标签</th>
                <th className="px-4 py-2.5 text-left font-medium">官方</th>
                <th className="px-4 py-2.5 text-left font-medium">录入人</th>
                <th className="px-4 py-2.5 text-left font-medium">创建</th>
                <th className="px-4 py-2.5 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {tools.map((t) => {
                const meta = toolCategoryMeta(t.category);
                return (
                  <tr key={t.id} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{t.name}</div>
                      <Link
                        href={t.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-muted-foreground hover:text-primary hover:underline"
                      >
                        {t.url}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      <span aria-hidden className="mr-1">
                        {meta.emoji}
                      </span>
                      {meta.label}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {TOOL_PRICING_LABEL[t.pricing as ToolPricingValue] ??
                        t.pricing}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex max-w-[260px] flex-wrap gap-1">
                        {t.tags.slice(0, 4).map((tag) => (
                          <span
                            key={tag}
                            className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                        {t.tags.length > 4 && (
                          <span className="text-[10px] text-muted-foreground/70">
                            +{t.tags.length - 4}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      {t.isOfficial ? (
                        <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300">
                          官方
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {t.createdBy?.name ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {t.createdAt.toISOString().slice(0, 10)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <form action={adminDeleteTool}>
                        <input type="hidden" name="id" value={t.id} />
                        <button
                          type="submit"
                          className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-xs text-rose-300 transition-colors hover:bg-rose-500/20"
                        >
                          删除
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
              {tools.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    工具库还没有数据
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
