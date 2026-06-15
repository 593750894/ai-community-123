import Link from "next/link";
import { Hourglass, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { FilterChip } from "@/components/ui/filter-chip";
import { MoneyText } from "@/components/ui/money-text";
import {
  PillTag,
  pillTagTintClass,
  type PillTagTint,
} from "@/components/ui/pill-tag";
import { ResolveClawbackDialog } from "@/components/admin/resolve-clawback-dialog";
import {
  CLAWBACK_STATUSES,
  CLAWBACK_STATUS_LABEL,
  getAdminClawbackOverview,
  listClawbacksForAdmin,
  type ClawbackStatusValue,
} from "@/lib/commerce/clawbacks";
import { formatPrice } from "@/lib/commerce/schemas";
import { cn, formatRelativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

const STATUS_TINT: Record<ClawbackStatusValue, PillTagTint> = {
  PENDING: "amber",
  DEDUCTED: "emerald",
  MANUAL: "cyan",
  WAIVED: "slate",
};

function parseStatus(raw?: string): ClawbackStatusValue | undefined {
  if (!raw) return undefined;
  return (CLAWBACK_STATUSES as readonly string[]).includes(raw)
    ? (raw as ClawbackStatusValue)
    : undefined;
}

export default async function AdminClawbacksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const status = parseStatus(sp.status);
  const page = Math.max(1, Number(sp.page) || 1);

  const [{ items, total }, overview] = await Promise.all([
    listClawbacksForAdmin({ status, page, pageSize: PAGE_SIZE }),
    getAdminClawbackOverview(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currency = items[0]?.currency ?? "CNY";
  const currencyPrefix = currency === "CNY" ? "¥" : `${currency} `;

  const stats = [
    {
      label: `待处理（${overview.pendingCount} 笔）`,
      value: (
        <MoneyText
          value={overview.pendingTotalCents}
          currency={currencyPrefix}
        />
      ),
      icon: Hourglass,
      tint: "amber" as PillTagTint,
      href: "/admin/clawbacks?status=PENDING",
    },
    {
      label: "本月已处理",
      value: <span>{overview.resolvedThisMonthCount}</span>,
      icon: ShieldCheck,
      tint: "emerald" as PillTagTint,
      href: "/admin/clawbacks?status=DEDUCTED",
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="管理后台"
        title="退款追讨"
        description={`共 ${total} 条记录${
          status ? ` · 筛选 ${CLAWBACK_STATUS_LABEL[status]}` : ""
        }。Payout 已 PAID 后的退款会落入此处；选择「已抵扣 / 线下追回 / 平台豁免」三类终态处理，落 AuditLog。`}
      />

      <div className="space-y-6 px-6 py-6 sm:px-8">
        <section className="grid gap-3 sm:grid-cols-2">
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

        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            href="/admin/clawbacks"
            active={!status}
            label="全部"
            count={total}
          />
          {CLAWBACK_STATUSES.map((s) => (
            <FilterChip
              key={s}
              href={`/admin/clawbacks?status=${s}`}
              active={status === s}
              label={CLAWBACK_STATUS_LABEL[s]}
            />
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card/40">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">订单</th>
                <th className="px-4 py-2.5 text-left font-medium">卖家</th>
                <th className="px-4 py-2.5 text-right font-medium">
                  本次退款 / 应追
                </th>
                <th className="px-4 py-2.5 text-left font-medium">关联结算单</th>
                <th className="px-4 py-2.5 text-left font-medium">状态</th>
                <th className="px-4 py-2.5 text-left font-medium">时间 / 处理人</th>
                <th className="px-4 py-2.5 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((c) => (
                <tr key={c.id} className="align-top hover:bg-muted/20">
                  <td className="px-4 py-3 text-xs">
                    <Link
                      href={`/admin/orders/${c.orderNo}`}
                      className="font-mono text-[11px] hover:text-primary"
                    >
                      {c.orderNo}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <Link
                      href={`/profile/${c.seller.id}`}
                      className="font-medium hover:text-primary"
                    >
                      {c.seller.name}
                    </Link>
                    <div className="text-[10px] text-muted-foreground">
                      @{c.seller.username}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-xs tabular-nums">
                    <div>{formatPrice(c.refund.amountCents, c.currency)}</div>
                    <div className="font-semibold text-tag-rose-fg">
                      {formatPrice(c.amountCents, c.currency)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="font-mono text-[10px]">{c.payout.id}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {c.payout.status}
                      {c.payout.paidAt
                        ? ` · ${c.payout.paidAt.toISOString().slice(0, 10)}`
                        : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <PillTag tint={STATUS_TINT[c.status]} icon={null} size="sm">
                      {CLAWBACK_STATUS_LABEL[c.status]}
                    </PillTag>
                    {c.note && (
                      <div className="mt-1 line-clamp-2 max-w-[200px] text-[10px] text-muted-foreground">
                        {c.note}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    <div>{formatRelativeTime(c.createdAt)}</div>
                    {c.resolvedAt && c.resolvedBy && (
                      <div className="text-[10px] text-muted-foreground/70">
                        @{c.resolvedBy.username} ·{" "}
                        {c.resolvedAt.toISOString().slice(0, 10)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-xs">
                    {c.status === "PENDING" ? (
                      <ResolveClawbackDialog
                        clawbackId={c.id}
                        orderNo={c.orderNo}
                        sellerUsername={c.seller.username}
                        amountCents={c.amountCents}
                        currency={c.currency}
                      />
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
                    colSpan={7}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    {status ? "没有该状态的追讨记录" : "暂无追讨记录"}
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
            status={status}
          />
        )}
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
  status?: ClawbackStatusValue;
}) {
  const href = (p: number) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    params.set("page", String(p));
    return `/admin/clawbacks?${params.toString()}`;
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
