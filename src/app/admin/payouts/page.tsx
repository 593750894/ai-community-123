import Link from "next/link";
import { Banknote, Coins, Hourglass, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { FilterChip } from "@/components/ui/filter-chip";
import { MoneyText } from "@/components/ui/money-text";
import {
  PillTag,
  pillTagTintClass,
  type PillTagTint,
} from "@/components/ui/pill-tag";
import { MarkPayoutPaidDialog } from "@/components/admin/mark-payout-paid-dialog";
import {
  getAdminPayoutOverview,
  listPayoutsForAdmin,
} from "@/lib/commerce/payouts";
import {
  PAYOUT_METHOD_LABEL,
  PAYOUT_STATUSES,
  PAYOUT_STATUS_LABEL,
  formatPrice,
  type PayoutStatusValue,
} from "@/lib/commerce/schemas";
import { cn, formatRelativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

// PayoutStatus → PillTag tint (V2 7-tint vocabulary). Pair with
// pillTagTintClass() when the surface needs the tinted bg/fg classes.
const STATUS_TINT: Record<PayoutStatusValue, PillTagTint> = {
  PENDING: "amber",
  AVAILABLE: "emerald",
  PAID: "cyan",
  CANCELED: "slate",
};

function parseStatus(raw?: string): PayoutStatusValue | undefined {
  if (!raw) return undefined;
  return (PAYOUT_STATUSES as readonly string[]).includes(raw)
    ? (raw as PayoutStatusValue)
    : undefined;
}

export default async function AdminPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    pendingRequest?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const status = parseStatus(sp.status);
  const pendingRequest = sp.pendingRequest === "1";
  const q = (sp.q ?? "").trim() || undefined;
  const page = Math.max(1, Number(sp.page) || 1);

  const [{ items, total }, overview] = await Promise.all([
    listPayoutsForAdmin({
      status,
      pendingRequest,
      q,
      page,
      pageSize: PAGE_SIZE,
    }),
    getAdminPayoutOverview(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasAnyFilter = !!(status || pendingRequest || q);
  const currency = items[0]?.currency ?? "CNY";

  const currencyPrefix = currency === "CNY" ? "¥" : `${currency} `;
  const stats: Array<{
    label: string;
    value: React.ReactNode;
    icon: typeof Hourglass;
    tint: PillTagTint;
    href: string;
  }> = [
    {
      label: "待申请提现（等冷藏期结束）",
      value: (
        <MoneyText
          value={overview.pendingNetCents}
          currency={currencyPrefix}
        />
      ),
      icon: Hourglass,
      tint: "amber",
      href: "/admin/payouts?status=PENDING",
    },
    {
      label: "可申请提现总额",
      value: (
        <MoneyText
          value={overview.availableNetCents}
          currency={currencyPrefix}
        />
      ),
      icon: Banknote,
      tint: "emerald",
      href: "/admin/payouts?status=AVAILABLE",
    },
    {
      label: `待处理提现（${overview.pendingRequestCount} 笔）`,
      value: (
        <MoneyText
          value={overview.requestedNetCents}
          currency={currencyPrefix}
        />
      ),
      icon: Coins,
      tint: "rose",
      href: "/admin/payouts?pendingRequest=1",
    },
    {
      label: "已结算累计",
      value: (
        <MoneyText
          value={overview.paidNetCents}
          currency={currencyPrefix}
        />
      ),
      icon: ShieldCheck,
      tint: "cyan",
      href: "/admin/payouts?status=PAID",
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="管理后台"
        title="结算管理"
        description={`共 ${total} 条结算单${
          pendingRequest ? " · 仅显示待处理提现" : ""
        }。点击「标记已打款」前请先在第三方渠道完成实际转账；操作落 AuditLog + 推卖家 PAYOUT_PAID 通知。`}
      />

      <div className="space-y-6 px-6 py-6 sm:px-8">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <Link
              key={s.label}
              href={s.href}
              className="group flex items-start justify-between gap-3 rounded-xl border border-border bg-card/40 p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card/70"
            >
              <div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
                <div className="mt-1 text-xl font-semibold tabular-nums">
                  {s.value}
                </div>
              </div>
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${pillTagTintClass(s.tint)}`}
              >
                <s.icon className="size-4" />
              </span>
            </Link>
          ))}
        </section>

        <form
          method="GET"
          className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card/40 p-3"
        >
          <Labeled label="搜索（卖家 / 订单号）">
            <input
              type="text"
              name="q"
              defaultValue={q ?? ""}
              placeholder="@username 或 完整订单号"
              className="block h-9 w-64 rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-primary/60"
            />
          </Labeled>
          {status && <input type="hidden" name="status" value={status} />}
          {pendingRequest && (
            <input type="hidden" name="pendingRequest" value="1" />
          )}
          <button
            type="submit"
            className="inline-flex h-9 items-center gap-1 rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            搜索
          </button>
          {hasAnyFilter && (
            <Link
              href="/admin/payouts"
              className="inline-flex h-9 items-center gap-1 rounded-full border border-border px-3 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            >
              清除筛选
            </Link>
          )}
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            href="/admin/payouts"
            active={!status && !pendingRequest}
            label="全部"
            count={total}
          />
          <FilterChip
            href="/admin/payouts?pendingRequest=1"
            active={pendingRequest}
            label="待处理提现"
            count={overview.pendingRequestCount}
          />
          {PAYOUT_STATUSES.map((s) => (
            <FilterChip
              key={s}
              href={`/admin/payouts?status=${s}`}
              active={status === s && !pendingRequest}
              label={PAYOUT_STATUS_LABEL[s]}
            />
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card/40">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">订单 / 商品</th>
                <th className="px-4 py-2.5 text-left font-medium">卖家</th>
                <th className="px-4 py-2.5 text-right font-medium">
                  成交 / 抽成
                </th>
                <th className="px-4 py-2.5 text-right font-medium">净额</th>
                <th className="px-4 py-2.5 text-left font-medium">收款账号</th>
                <th className="px-4 py-2.5 text-left font-medium">状态</th>
                <th className="px-4 py-2.5 text-left font-medium">时间</th>
                <th className="px-4 py-2.5 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((p) => (
                <tr key={p.id} className="align-top hover:bg-muted/20">
                  <td className="px-4 py-3 text-xs">
                    <div className="font-mono text-[11px] text-foreground/90">
                      {p.orderNo}
                    </div>
                    {p.workflowItem ? (
                      <Link
                        href={`/marketplace/${p.workflowItem.id}`}
                        className="mt-0.5 line-clamp-2 max-w-[220px] text-[11px] text-muted-foreground hover:text-primary"
                      >
                        {p.workflowItem.title}
                      </Link>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/60">
                        —
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <Link
                      href={`/profile/${p.seller.id}`}
                      className="font-medium hover:text-primary"
                    >
                      {p.seller.name}
                    </Link>
                    <div className="text-[10px] text-muted-foreground">
                      @{p.seller.username}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-xs tabular-nums">
                    <div>
                      <MoneyText
                        value={p.grossCents}
                        currency={p.currency === "CNY" ? "¥" : `${p.currency} `}
                      />
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      抽成{" "}
                      <MoneyText
                        value={p.platformFeeCents}
                        currency={p.currency === "CNY" ? "¥" : `${p.currency} `}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-semibold tabular-nums">
                    {formatPrice(p.netCents, p.currency)}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {p.sellerAccount.hasAccount ? (
                      <div>
                        <div className="text-[11px]">
                          {p.sellerAccount.payoutMethod
                            ? PAYOUT_METHOD_LABEL[
                                p.sellerAccount.payoutMethod
                              ]
                            : "—"}
                        </div>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {p.sellerAccount.payoutAccount}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {p.sellerAccount.payoutName}
                        </div>
                      </div>
                    ) : (
                      <span className="text-[10px] text-accent-amber">
                        未绑定
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <PillTag tint={STATUS_TINT[p.status]} icon={null} size="sm">
                      {PAYOUT_STATUS_LABEL[p.status]}
                    </PillTag>
                    {p.status === "AVAILABLE" && p.requestedAt && (
                      <div className="mt-1 text-[10px] text-accent-amber">
                        卖家已申请
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    <div>{formatRelativeTime(p.createdAt)}</div>
                    <div className="text-[10px] text-muted-foreground/70">
                      {p.status === "PENDING"
                        ? `可提现 ${p.availableAt.toISOString().slice(0, 10)}`
                        : p.status === "PAID" && p.paidAt
                        ? `打款 ${p.paidAt.toISOString().slice(0, 10)}`
                        : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-xs">
                    {p.status === "AVAILABLE" ? (
                      <MarkPayoutPaidDialog
                        payoutId={p.id}
                        orderNo={p.orderNo}
                        netCents={p.netCents}
                        currency={p.currency}
                        sellerUsername={p.seller.username}
                        account={p.sellerAccount}
                      />
                    ) : p.status === "PAID" && p.paidNote ? (
                      <span
                        title={p.paidNote}
                        className="line-clamp-1 max-w-[160px] text-[10px] text-muted-foreground"
                      >
                        {p.paidNote}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/60">
                        —
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    {hasAnyFilter ? "没有符合条件的结算单" : "暂无结算单"}
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
            params={{ status, pendingRequest: pendingRequest ? "1" : undefined, q }}
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
  params: { status?: string; pendingRequest?: string; q?: string };
}) {
  const base = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) base.set(k, v);
  }
  const href = (p: number) => {
    const x = new URLSearchParams(base);
    x.set("page", String(p));
    return `/admin/payouts?${x.toString()}`;
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
