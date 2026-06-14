import Link from "next/link";
import { Banknote, Coins, Hourglass, Receipt, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChip } from "@/components/ui/filter-chip";
import { MoneyText } from "@/components/ui/money-text";
import {
  PillTag,
  pillTagTintClass,
  type PillTagTint,
} from "@/components/ui/pill-tag";
import { PayoutAccountForm } from "@/components/me/payout-account-form";
import { RequestPayoutButton } from "@/components/me/request-payout-button";
import { requireUser } from "@/lib/auth/guard";
import {
  getEarningsSummary,
  listMyPayouts,
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

const PAGE_SIZE = 20;

// PayoutStatus → PillTag tint (V2 7-tint vocabulary).
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

export default async function MyEarningsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const user = await requireUser("/me/earnings");
  const sp = await searchParams;
  const status = parseStatus(sp.status);
  const page = Math.max(1, Number(sp.page) || 1);

  const [summary, { items, total }] = await Promise.all([
    getEarningsSummary(user.id),
    listMyPayouts({ sellerId: user.id, status, page, pageSize: PAGE_SIZE }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currency = items[0]?.currency ?? "CNY";

  const feeDisplay = (summary.platformFeeBps / 100).toFixed(
    summary.platformFeeBps % 100 === 0 ? 0 : 1,
  );

  const stats: Array<{
    label: string;
    valueCents: number;
    icon: typeof Coins;
    tint: PillTagTint;
    hint: string;
  }> = [
    {
      label: "累计净收益",
      valueCents: summary.totalNetCents,
      icon: Coins,
      tint: "emerald",
      hint: `不含已退款 / 取消订单 · 平台抽成 ${feeDisplay}%`,
    },
    {
      label: "冷藏中",
      valueCents: summary.byStatus.PENDING.netCents,
      icon: Hourglass,
      tint: "amber",
      hint: `${summary.byStatus.PENDING.count} 笔 · 付款后 ${summary.payoutHoldDays} 天可申请`,
    },
    {
      label: "可申请提现",
      valueCents: summary.byStatus.AVAILABLE.netCents,
      icon: Banknote,
      tint: "cyan",
      hint: `${summary.byStatus.AVAILABLE.count} 笔 · 含已申请 ${formatPrice(summary.pendingRequestNetCents, currency)}`,
    },
    {
      label: "已结算",
      valueCents: summary.byStatus.PAID.netCents,
      icon: ShieldCheck,
      tint: "blue",
      hint: `${summary.byStatus.PAID.count} 笔 · admin 已完成线下打款`,
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="我的收益"
        title="创作者收益与结算"
        description={`累计成交 ${formatPrice(summary.totalGrossCents, currency)} · 平台抽成 ${formatPrice(summary.totalPlatformFeeCents, currency)}（${feeDisplay}%）· 冷藏期 ${summary.payoutHoldDays} 天后可申请提现。`}
      />

      <div className="space-y-6 px-4 py-5 sm:px-8 sm:py-6">
        {/* 统计卡 */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card/40 p-4"
            >
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">{s.label}</div>
                <MoneyText
                  value={s.valueCents}
                  currency={currency === "CNY" ? "¥" : currency}
                  className="block text-xl font-semibold"
                />
                <div className="text-[10px] text-muted-foreground/80">
                  {s.hint}
                </div>
              </div>
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${pillTagTintClass(s.tint)}`}
              >
                <s.icon className="size-4" />
              </span>
            </div>
          ))}
        </section>

        {/* 提现申请卡 */}
        <section className="space-y-3 rounded-xl border border-border bg-card/40 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold">提现申请</h2>
              <p className="text-xs text-muted-foreground">
                结算单冷藏 {summary.payoutHoldDays} 天后自动转为可提现。点击「申请提现」后，admin 将通过你绑定的收款渠道线下打款，并在 /me/earnings 中标记为已结算。
              </p>
            </div>
            <RequestPayoutButton
              hasAccount={summary.account.hasAccount}
              availableNetCents={summary.byStatus.AVAILABLE.netCents}
              availableCount={summary.byStatus.AVAILABLE.count}
              hasPendingRequest={summary.hasPendingRequest}
              pendingRequestNetCents={summary.pendingRequestNetCents}
              currency={currency}
            />
          </div>
        </section>

        {/* 收款账号绑定 */}
        <section className="space-y-3">
          <div className="flex items-end justify-between">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold">收款账号</h2>
              <p className="text-xs text-muted-foreground">
                {summary.account.hasAccount
                  ? `当前绑定：${PAYOUT_METHOD_LABEL[summary.account.payoutMethod!]} · ${summary.account.payoutAccount} · ${summary.account.payoutName}`
                  : "尚未绑定收款账号，请先填写以便申请提现。"}
              </p>
            </div>
          </div>
          <PayoutAccountForm initial={summary.account} />
        </section>

        {/* Payouts 列表 */}
        <section className="space-y-3">
          <div className="flex items-end justify-between">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold">结算单</h2>
              <p className="text-xs text-muted-foreground">
                每笔市集订单付款成功后会自动生成一条结算单；状态变化与全额退款的关系详见左下角说明。
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <FilterChip
              href="/me/earnings"
              active={!status}
              label="全部"
              count={total}
            />
            {PAYOUT_STATUSES.map((s) => (
              <FilterChip
                key={s}
                href={`/me/earnings?status=${s}`}
                active={status === s}
                label={PAYOUT_STATUS_LABEL[s]}
              />
            ))}
          </div>

          {items.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title={status ? "没有匹配的结算单" : "还没有结算单"}
              description={
                status
                  ? "切换其它筛选条件查看其它结算单。"
                  : "上架你的第一个工作流到 /me/workflows，等待买家下单。"
              }
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card/40">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">订单</th>
                    <th className="px-4 py-2.5 text-left font-medium">商品</th>
                    <th className="px-4 py-2.5 text-right font-medium">
                      成交 / 抽成
                    </th>
                    <th className="px-4 py-2.5 text-right font-medium">净额</th>
                    <th className="px-4 py-2.5 text-left font-medium">状态</th>
                    <th className="px-4 py-2.5 text-left font-medium">时间</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((p) => (
                    <tr key={p.id} className="align-top hover:bg-muted/20">
                      <td className="px-4 py-3 text-xs">
                        <div className="font-mono text-[11px] text-foreground/90">
                          {p.orderNo}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {p.workflowItem ? (
                          <Link
                            href={`/marketplace/${p.workflowItem.id}`}
                            className="line-clamp-2 max-w-[260px] font-medium hover:text-primary"
                          >
                            {p.workflowItem.title}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-xs tabular-nums">
                        <div>
                          <MoneyText
                            value={p.grossCents}
                            currency={p.currency === "CNY" ? "¥" : p.currency}
                          />
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          抽成{" "}
                          <MoneyText
                            value={p.platformFeeCents}
                            currency={p.currency === "CNY" ? "¥" : p.currency}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <MoneyText
                          value={p.netCents}
                          currency={p.currency}
                          className="text-xs font-semibold"
                        />
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <PillTag tint={STATUS_TINT[p.status]} icon={null} size="sm">
                          {PAYOUT_STATUS_LABEL[p.status]}
                        </PillTag>
                        {p.status === "AVAILABLE" && p.requestedAt && (
                          <div className="mt-1 text-[10px] text-accent-amber">
                            已申请 {formatRelativeTime(p.requestedAt)}
                          </div>
                        )}
                        {p.status === "PAID" && p.paidNote && (
                          <div className="mt-1 line-clamp-2 max-w-[200px] text-[10px] text-muted-foreground">
                            {p.paidNote}
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} status={status} />
          )}
        </section>
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
  status?: PayoutStatusValue;
}) {
  const base = new URLSearchParams();
  if (status) base.set("status", status);
  const href = (p: number) => {
    const params = new URLSearchParams(base);
    params.set("page", String(p));
    return `/me/earnings?${params.toString()}`;
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
