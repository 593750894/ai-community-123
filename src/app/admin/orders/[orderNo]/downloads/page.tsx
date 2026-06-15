import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Download } from "lucide-react";

import { requireAdmin } from "@/lib/auth/guard";
import { getOrderForAdmin } from "@/lib/commerce/order-queries";
import { ORDER_NO_RE } from "@/lib/commerce/orders";
import { listDownloadGrantsForOrder } from "@/lib/commerce/download-queries";
import { formatRelativeTime } from "@/lib/utils";

export const metadata: Metadata = {
  title: "下载兑换记录 · 管理后台 · SeedLand · V",
  description: "查看付费工作流订单的下载签发与兑换审计。",
};

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ orderNo: string }>;
}

/**
 * Stage 16.5：付费下载兑换的 admin 审计视图。
 *
 * 路由：/admin/orders/[orderNo]/downloads
 * 入口：`/admin/orders` 表格行的「下载记录」链接（仅 PAID + WORKFLOW_PURCHASE 显示）。
 *
 * 显示什么 / 不显示什么：
 *   - 显示：每次成功 redeem 的时间、买家、token nonce、IP（如可得）、UA 哈希（前 16 字节十六进制）、
 *     token 签发 / 过期时间。
 *   - 不显示：实际跳转到的卖家裸 URL — 那是商业敏感信息，admin 应通过 /me/workflows
 *     的卖家视图核对。本视图只关心「谁在何时拉了多少次」。
 *   - 失败的 redeem（token 篡改 / 过期 / refund 后）**不会**出现 — 这些只在 server access log 里。
 */
export default async function AdminOrderDownloadsPage({ params }: PageProps) {
  await requireAdmin(`/admin/orders`);
  const { orderNo } = await params;
  if (!ORDER_NO_RE.test(orderNo)) notFound();

  const order = await getOrderForAdmin(orderNo);
  if (!order) notFound();

  const grants = await listDownloadGrantsForOrder(orderNo);

  return (
    <>
      <PageHeader
        eyebrow={`订单 ${orderNo}`}
        title="下载兑换记录"
        description={
          order.type === "WORKFLOW_PURCHASE"
            ? "每次成功兑换签名 URL 后写一行；token 过期 / 退款撤销 / 验签失败的尝试不会出现在此表。"
            : "该订单类型不涉及付费下载，本页应无记录。"
        }
        actions={
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<Link href="/admin/orders" />}
          >
            ← 返回订单列表
          </Button>
        }
      />

      <div className="space-y-4 px-4 py-5 sm:px-8 sm:py-6">
        <section className="rounded-xl border border-border bg-card/40 p-4 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <span>
              <span className="text-foreground/70">买家：</span>
              {order.buyer.name}（@{order.buyer.username}）
            </span>
            {order.workflowItem && (
              <span>
                <span className="text-foreground/70">商品：</span>
                {order.workflowItem.title}
              </span>
            )}
            <span>
              <span className="text-foreground/70">状态：</span>
              {order.status}
              {order.refundCents > 0 && (
                <span className="ml-1 text-tag-cyan-fg">（含退款）</span>
              )}
            </span>
          </div>
        </section>

        {grants.length === 0 ? (
          <EmptyState
            icon={Download}
            title="暂无下载兑换记录"
            description="买家尚未成功下载过该工作流；或卖家未配置文件，redeem 全部 404。"
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card/40">
            <table className="w-full text-xs">
              <thead className="bg-muted/30 text-[11px] text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">兑换时间</th>
                  <th className="px-4 py-2.5 text-left font-medium">买家</th>
                  <th className="px-4 py-2.5 text-left font-medium">IP</th>
                  <th className="px-4 py-2.5 text-left font-medium">UA 哈希</th>
                  <th className="px-4 py-2.5 text-left font-medium">Token 签发</th>
                  <th className="px-4 py-2.5 text-left font-medium">Token 过期</th>
                  <th className="px-4 py-2.5 text-left font-medium">Nonce</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {grants.map((g) => (
                  <tr key={g.id} className="align-top hover:bg-muted/20">
                    <td className="px-4 py-2.5">
                      <div>{formatRelativeTime(g.redeemedAt)}</div>
                      <div className="text-[10px] text-muted-foreground/70">
                        {g.redeemedAt.toISOString().slice(0, 19).replace("T", " ")}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div>{g.user.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        @{g.user.username}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px]">
                      {g.ip ?? "—"}
                    </td>
                    <td
                      className="max-w-[18ch] truncate px-4 py-2.5 font-mono text-[11px] text-muted-foreground"
                      title={g.userAgentHash ?? ""}
                    >
                      {g.userAgentHash ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {g.issuedAt.toISOString().slice(11, 19)}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {g.expiresAt.toISOString().slice(11, 19)}
                    </td>
                    <td
                      className="max-w-[16ch] truncate px-4 py-2.5 font-mono text-[11px] text-muted-foreground"
                      title={g.tokenNonce}
                    >
                      {g.tokenNonce}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
