import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { RefundDialog } from "@/components/admin/refund-dialog";
import { listOrdersForAdmin } from "@/lib/commerce/order-queries";
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABEL,
  ORDER_TYPES,
  ORDER_TYPE_LABEL,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  formatPrice,
  type OrderStatusValue,
  type OrderTypeValue,
  type PaymentMethodValue,
} from "@/lib/commerce/schemas";
import { cn, formatRelativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

const STATUS_TONE: Record<OrderStatusValue, string> = {
  PENDING: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  PAID: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  REFUNDED: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300",
  CANCELED: "border-border/60 bg-muted/30 text-muted-foreground",
  FAILED: "border-rose-500/40 bg-rose-500/10 text-rose-300",
};

function pickEnum<T extends string>(
  raw: string | undefined,
  list: readonly string[],
): T | undefined {
  if (!raw) return undefined;
  return list.includes(raw) ? (raw as T) : undefined;
}

function parseDate(raw: string | undefined, endOfDay: boolean): Date | undefined {
  if (!raw) return undefined;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return undefined;
  if (endOfDay) d.setHours(23, 59, 59, 999);
  return d;
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    type?: string;
    paymentMethod?: string;
    q?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const status = pickEnum<OrderStatusValue>(sp.status, ORDER_STATUSES);
  const type = pickEnum<OrderTypeValue>(sp.type, ORDER_TYPES);
  const paymentMethod = pickEnum<PaymentMethodValue>(
    sp.paymentMethod,
    PAYMENT_METHODS,
  );
  const q = (sp.q ?? "").trim() || undefined;
  const from = parseDate(sp.from, false);
  const to = parseDate(sp.to, true);
  const page = Math.max(1, Number(sp.page) || 1);

  const { items, total } = await listOrdersForAdmin({
    status,
    type,
    paymentMethod,
    q,
    from,
    to,
    page,
    pageSize: PAGE_SIZE,
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasAnyFilter = !!(status || type || paymentMethod || q || from || to);

  return (
    <>
      <PageHeader
        eyebrow="管理后台"
        title="订单管理"
        description={`共 ${total} 笔订单。点击「退款」可对 PAID 订单发起全额 / 部分退款；操作落 AuditLog + 推买家通知。`}
      />

      <div className="space-y-4 px-6 py-6 sm:px-8">
        <form
          method="GET"
          className="flex flex-wrap items-end gap-3 rounded-xl border border-border/60 bg-card/40 p-3"
        >
          <Labeled label="状态">
            <select
              name="status"
              defaultValue={status ?? ""}
              className="block h-9 w-32 rounded-lg border border-border/60 bg-background px-2 text-xs outline-none focus:border-primary/60"
            >
              <option value="">全部</option>
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ORDER_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label="类型">
            <select
              name="type"
              defaultValue={type ?? ""}
              className="block h-9 w-36 rounded-lg border border-border/60 bg-background px-2 text-xs outline-none focus:border-primary/60"
            >
              <option value="">全部</option>
              {ORDER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ORDER_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label="渠道">
            <select
              name="paymentMethod"
              defaultValue={paymentMethod ?? ""}
              className="block h-9 w-32 rounded-lg border border-border/60 bg-background px-2 text-xs outline-none focus:border-primary/60"
            >
              <option value="">全部</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABEL[m]}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label="订单号 / 买家">
            <input
              type="text"
              name="q"
              defaultValue={q ?? ""}
              placeholder="完整订单号 或 @username"
              className="block h-9 w-56 rounded-lg border border-border/60 bg-background px-2 text-xs outline-none focus:border-primary/60"
            />
          </Labeled>
          <Labeled label="起始日期">
            <input
              type="date"
              name="from"
              defaultValue={sp.from ?? ""}
              className="block h-9 w-36 rounded-lg border border-border/60 bg-background px-2 text-xs outline-none focus:border-primary/60"
            />
          </Labeled>
          <Labeled label="结束日期">
            <input
              type="date"
              name="to"
              defaultValue={sp.to ?? ""}
              className="block h-9 w-36 rounded-lg border border-border/60 bg-background px-2 text-xs outline-none focus:border-primary/60"
            />
          </Labeled>
          <button
            type="submit"
            className="inline-flex h-9 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            筛选
          </button>
          {hasAnyFilter && (
            <Link
              href="/admin/orders"
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-border/60 px-3 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            >
              清除
            </Link>
          )}
        </form>

        <div className="overflow-hidden rounded-xl border border-border/60 bg-card/40">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">订单</th>
                <th className="px-4 py-2.5 text-left font-medium">买家</th>
                <th className="px-4 py-2.5 text-left font-medium">商品 / 计划</th>
                <th className="px-4 py-2.5 text-right font-medium">金额</th>
                <th className="px-4 py-2.5 text-left font-medium">渠道</th>
                <th className="px-4 py-2.5 text-left font-medium">状态</th>
                <th className="px-4 py-2.5 text-left font-medium">时间</th>
                <th className="px-4 py-2.5 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {items.map((o) => {
                const refundable =
                  o.status === "PAID" && o.refundCents < o.amountCents;
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
                      <Link
                        href={`/profile/${o.buyer.id}`}
                        className="font-medium hover:text-primary"
                      >
                        {o.buyer.name}
                      </Link>
                      <div className="text-[10px] text-muted-foreground">
                        @{o.buyer.username}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {o.plan ? (
                        <div>
                          <div className="font-medium">{o.plan.name}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {o.plan.slug}
                          </div>
                        </div>
                      ) : o.workflowItem ? (
                        <div>
                          <Link
                            href={`/marketplace/${o.workflowItem.id}`}
                            className="line-clamp-2 max-w-[260px] font-medium hover:text-primary"
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
                      <div>{formatPrice(o.amountCents, o.currency)}</div>
                      {o.refundCents > 0 && (
                        <div className="mt-0.5 text-[10px] text-cyan-300">
                          已退 {formatPrice(o.refundCents, o.currency)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {o.paymentMethod
                        ? PAYMENT_METHOD_LABEL[o.paymentMethod]
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
                          STATUS_TONE[o.status as OrderStatusValue],
                        )}
                      >
                        {ORDER_STATUS_LABEL[o.status as OrderStatusValue]}
                      </span>
                      {o.status === "PAID" && o.refundCents > 0 && (
                        <div className="mt-1 text-[10px] text-cyan-300">
                          含部分退款
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
                      <div className="flex flex-col items-end gap-1.5">
                        <Link
                          href={`/checkout/${o.orderNo}`}
                          className="text-[11px] text-primary hover:underline"
                        >
                          查看 →
                        </Link>
                        {refundable && (
                          <RefundDialog
                            orderNo={o.orderNo}
                            amountCents={o.amountCents}
                            refundCents={o.refundCents}
                            currency={o.currency}
                            paymentMethodLabel={
                              o.paymentMethod
                                ? PAYMENT_METHOD_LABEL[o.paymentMethod]
                                : "未知"
                            }
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    {hasAnyFilter ? "没有符合条件的订单" : "暂无订单"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            params={{
              status,
              type,
              paymentMethod,
              q,
              from: sp.from,
              to: sp.to,
            }}
          />
        )}
      </div>
    </>
  );
}

function Labeled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  params,
}: {
  page: number;
  totalPages: number;
  params: {
    status?: string;
    type?: string;
    paymentMethod?: string;
    q?: string;
    from?: string;
    to?: string;
  };
}) {
  const base = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) base.set(k, v);
  }
  const href = (p: number) => {
    const x = new URLSearchParams(base);
    x.set("page", String(p));
    return `/admin/orders?${x.toString()}`;
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
            "rounded-md border border-border/60 px-3 py-1",
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
            "rounded-md border border-border/60 px-3 py-1",
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
