import Link from "next/link";
import { Receipt } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChip } from "@/components/ui/filter-chip";
import { MoneyText } from "@/components/ui/money-text";
import { PillTag, type PillTagTint } from "@/components/ui/pill-tag";
import { requireUser } from "@/lib/auth/guard";
import { listMyOrders } from "@/lib/commerce/order-queries";
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABEL,
  ORDER_TYPE_LABEL,
  PAYMENT_METHOD_LABEL,
  type OrderStatusValue,
} from "@/lib/commerce/schemas";
import { cn, formatRelativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ status?: string; page?: string }>;
}

function parseStatus(raw?: string): OrderStatusValue | undefined {
  if (!raw) return undefined;
  return (ORDER_STATUSES as readonly string[]).includes(raw)
    ? (raw as OrderStatusValue)
    : undefined;
}

const STATUS_TINT: Record<OrderStatusValue, PillTagTint> = {
  PENDING: "amber",
  PAID: "emerald",
  REFUNDED: "cyan",
  CANCELED: "slate",
  FAILED: "rose",
};

const PAGE_SIZE = 20;

export default async function MyOrdersPage({ searchParams }: PageProps) {
  const user = await requireUser("/me/orders");
  const sp = await searchParams;
  const status = parseStatus(sp.status);
  const page = Math.max(1, Number(sp.page) || 1);

  const { items, total } = await listMyOrders({
    userId: user.id,
    status,
    page,
    pageSize: PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        eyebrow="我的订单"
        title="历史订单与退款"
        description={`共 ${total} 笔订单${
          status ? ` · 筛选：${ORDER_STATUS_LABEL[status]}` : ""
        }。订单付款 30 分钟内未支付将自动取消。`}
      />

      <div className="space-y-4 px-4 py-5 sm:px-8 sm:py-6">
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            href="/me/orders"
            active={!status}
            label="全部"
            count={total}
          />
          {ORDER_STATUSES.map((s) => (
            <FilterChip
              key={s}
              href={`/me/orders?status=${s}`}
              active={status === s}
              label={ORDER_STATUS_LABEL[s]}
            />
          ))}
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={status ? "没有匹配的订单" : "还没有订单"}
            description={
              status
                ? "切换其他筛选条件查看其它订单。"
                : "去 /marketplace 看看工作流，或在 /pricing 开通会员。"
            }
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card/40">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">订单</th>
                  <th className="px-4 py-2.5 text-left font-medium">商品</th>
                  <th className="px-4 py-2.5 text-right font-medium">金额</th>
                  <th className="px-4 py-2.5 text-left font-medium">渠道</th>
                  <th className="px-4 py-2.5 text-left font-medium">状态</th>
                  <th className="px-4 py-2.5 text-left font-medium">时间</th>
                  <th className="px-4 py-2.5 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((o) => {
                  const isRefunded = o.status === "REFUNDED";
                  const hasPartialRefund =
                    !isRefunded && o.refundCents > 0;
                  return (
                    <tr key={o.id} className="align-top hover:bg-muted/20">
                      <td className="px-4 py-3 text-xs">
                        <div className="font-mono text-[11px] text-foreground/90">
                          {o.orderNo}
                        </div>
                        <div className="mt-0.5 text-[10px] text-muted-foreground">
                          {ORDER_TYPE_LABEL[o.type]}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {o.plan ? (
                          <div>
                            <div className="font-medium">{o.plan.name}</div>
                            <div className="text-[10px] text-muted-foreground">
                              会员档位
                            </div>
                          </div>
                        ) : o.workflowItem ? (
                          <div>
                            <Link
                              href={`/marketplace/${o.workflowItem.id}`}
                              className="line-clamp-2 max-w-[280px] font-medium hover:text-primary"
                            >
                              {o.workflowItem.title}
                            </Link>
                            <div className="text-[10px] text-muted-foreground">
                              卖家 @{o.workflowItem.seller.username}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-xs tabular-nums">
                        <div>
                          <MoneyText
                            value={o.amountCents}
                            currency={o.currency === "CNY" ? "¥" : `${o.currency} `}
                          />
                        </div>
                        {o.refundCents > 0 && (
                          <div className="mt-0.5 text-[10px] text-cyan-300">
                            退款{" "}
                            <MoneyText
                              value={o.refundCents}
                              currency={o.currency === "CNY" ? "¥" : `${o.currency} `}
                            />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {o.paymentMethod
                          ? PAYMENT_METHOD_LABEL[o.paymentMethod]
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <PillTag tint={STATUS_TINT[o.status as OrderStatusValue]} icon={null} size="sm">
                          {ORDER_STATUS_LABEL[o.status as OrderStatusValue]}
                        </PillTag>
                        {hasPartialRefund && (
                          <div className="mt-1 text-[10px] text-tag-cyan-fg">
                            部分退款
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        <div>{formatRelativeTime(o.createdAt)}</div>
                        <div className="text-[10px] text-muted-foreground/70">
                          {o.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-xs">
                        {o.status === "PENDING" ? (
                          <Link
                            href={`/checkout/${o.orderNo}`}
                            className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] text-primary hover:bg-primary/20"
                          >
                            去支付
                          </Link>
                        ) : (
                          <Link
                            href={`/checkout/${o.orderNo}`}
                            className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                          >
                            详情
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && <Pagination page={page} totalPages={totalPages} status={status} />}
      </div>
    </>
  );
}

function Pagination({
  page,
  totalPages,
  status,
}: {
  page: number;
  totalPages: number;
  status?: OrderStatusValue;
}) {
  const base = new URLSearchParams();
  if (status) base.set("status", status);
  const href = (p: number) => {
    const params = new URLSearchParams(base);
    params.set("page", String(p));
    return `/me/orders?${params.toString()}`;
  };
  return (
    <div className="flex items-center justify-between text-xs text-muted-foreground">
      <span>
        第 {page} / {totalPages} 页
      </span>
      <div className="flex gap-2">
        <Link
          href={href(Math.max(1, page - 1))}
          aria-disabled={page <= 1}
          className={cn(
            "rounded-full border border-border px-3 py-1",
            page <= 1
              ? "pointer-events-none opacity-40"
              : "hover:bg-muted/60 hover:text-foreground",
          )}
        >
          上一页
        </Link>
        <Link
          href={href(Math.min(totalPages, page + 1))}
          aria-disabled={page >= totalPages}
          className={cn(
            "rounded-full border border-border px-3 py-1",
            page >= totalPages
              ? "pointer-events-none opacity-40"
              : "hover:bg-muted/60 hover:text-foreground",
          )}
        >
          下一页
        </Link>
      </div>
    </div>
  );
}
