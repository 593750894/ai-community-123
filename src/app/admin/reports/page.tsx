import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { PillTag, type PillTagTint } from "@/components/ui/pill-tag";
import { listReports } from "@/lib/reports/queries";
import {
  REPORT_REASON_LABEL,
  REPORT_STATUSES,
  REPORT_STATUS_LABEL,
  REPORT_TARGET_LABEL,
  REPORT_TARGET_TYPES,
  type ReportReason,
  type ReportStatusValue,
  type ReportTargetTypeValue,
} from "@/lib/reports/schemas";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils";

import {
  adminDismissReportFormAction,
  adminResolveReportFormAction,
} from "./actions";

export const dynamic = "force-dynamic";

const STATUS_TINT: Record<ReportStatusValue, PillTagTint> = {
  PENDING: "amber",
  REVIEWING: "cyan",
  RESOLVED: "emerald",
  DISMISSED: "slate",
};

const PAGE_SIZE = 20;

function parseStatus(value: string | undefined): ReportStatusValue | undefined {
  return value && (REPORT_STATUSES as readonly string[]).includes(value)
    ? (value as ReportStatusValue)
    : undefined;
}

function parseTargetType(
  value: string | undefined,
): ReportTargetTypeValue | undefined {
  return value && (REPORT_TARGET_TYPES as readonly string[]).includes(value)
    ? (value as ReportTargetTypeValue)
    : undefined;
}

function safeReasonLabel(raw: string): string {
  return (
    REPORT_REASON_LABEL[raw as ReportReason] ??
    raw // 未来运营加新原因时，未注册的 key 直接落地为原值
  );
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    targetType?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const status = parseStatus(sp.status);
  const targetType = parseTargetType(sp.targetType);
  const page = Math.max(1, Number(sp.page) || 1);

  const { items, total } = await listReports({
    status,
    targetType,
    page,
    pageSize: PAGE_SIZE,
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        eyebrow="管理后台"
        title="举报处理"
        description={`共 ${total} 条记录。当前筛选：${
          status ? REPORT_STATUS_LABEL[status] : "全部状态"
        } · ${targetType ? REPORT_TARGET_LABEL[targetType] : "全部类型"}`}
      />

      <div className="space-y-4 px-6 py-6 sm:px-8">
        {/* 筛选栏 —— 原生 GET form，不需要 JS */}
        <form
          method="GET"
          className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card/40 p-3"
        >
          <div className="space-y-1">
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
              状态
            </label>
            <select
              name="status"
              defaultValue={status ?? ""}
              className="block h-9 w-36 rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-primary/60"
            >
              <option value="">全部</option>
              {REPORT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {REPORT_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
              目标类型
            </label>
            <select
              name="targetType"
              defaultValue={targetType ?? ""}
              className="block h-9 w-36 rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-primary/60"
            >
              <option value="">全部</option>
              {REPORT_TARGET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {REPORT_TARGET_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="inline-flex h-9 items-center gap-1 rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            筛选
          </button>
          {(status || targetType) && (
            <Link
              href="/admin/reports"
              className="inline-flex h-9 items-center gap-1 rounded-full border border-border px-3 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            >
              清除
            </Link>
          )}
        </form>

        <div className="overflow-hidden rounded-xl border border-border bg-card/40">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">举报人</th>
                <th className="px-4 py-2.5 text-left font-medium">目标</th>
                <th className="px-4 py-2.5 text-left font-medium">原因</th>
                <th className="px-4 py-2.5 text-left font-medium">状态</th>
                <th className="px-4 py-2.5 text-left font-medium">时间</th>
                <th className="px-4 py-2.5 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((r) => {
                const isOpen = r.status === "PENDING" || r.status === "REVIEWING";
                return (
                  <tr key={r.id} className="align-top hover:bg-muted/20">
                    <td className="px-4 py-3 text-xs">
                      <Link
                        href={`/profile/${r.reporter.id}`}
                        className="font-medium text-foreground/90 hover:text-primary"
                      >
                        {r.reporter.name}
                      </Link>
                      <div className="text-[10px] text-muted-foreground">
                        @{r.reporter.username}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="font-medium text-foreground/90">
                        {r.targetLabel}
                      </div>
                      {r.targetPreview ? (
                        r.targetLink ? (
                          <Link
                            href={r.targetLink}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="mt-0.5 line-clamp-2 block text-[11px] text-primary hover:underline"
                          >
                            {r.targetPreview}
                          </Link>
                        ) : (
                          <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                            {r.targetPreview}
                          </div>
                        )
                      ) : (
                        <div className="mt-0.5 text-[11px] text-muted-foreground/70">
                          目标已删除或无法预览
                        </div>
                      )}
                      <div className="mt-0.5 font-mono text-[10px] text-muted-foreground/70">
                        {r.targetId.slice(0, 12)}…
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="font-medium">
                        {safeReasonLabel(r.reason)}
                      </div>
                      {r.description && (
                        <div className="mt-0.5 line-clamp-3 text-[11px] text-muted-foreground">
                          {r.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <PillTag tint={STATUS_TINT[r.status]} icon={null} size="sm">
                        {REPORT_STATUS_LABEL[r.status]}
                      </PillTag>
                      {r.resolvedBy && (
                        <div className="mt-1 text-[10px] text-muted-foreground">
                          处理：{r.resolvedBy.name}
                        </div>
                      )}
                      {r.resolvedAt && (
                        <div className="text-[10px] text-muted-foreground">
                          {formatRelativeTime(r.resolvedAt)}
                        </div>
                      )}
                      {r.resolution && (
                        <div className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                          意见：{r.resolution}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatRelativeTime(r.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs">
                      {isOpen ? (
                        <div className="flex flex-col items-end gap-1.5">
                          <form
                            action={adminResolveReportFormAction}
                            className="flex flex-wrap items-center justify-end gap-1.5"
                          >
                            <input type="hidden" name="id" value={r.id} />
                            <label className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                              <input
                                type="checkbox"
                                name="deleteTarget"
                                className="size-3"
                              />
                              同时删除目标
                            </label>
                            <button
                              type="submit"
                              className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-300 hover:bg-emerald-500/20"
                            >
                              处理
                            </button>
                          </form>
                          <form action={adminDismissReportFormAction}>
                            <input type="hidden" name="id" value={r.id} />
                            <button
                              type="submit"
                              className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                            >
                              驳回
                            </button>
                          </form>
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground/60">
                          已结案
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    暂无举报记录
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
            targetType={targetType}
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
  targetType,
}: {
  page: number;
  totalPages: number;
  status?: ReportStatusValue;
  targetType?: ReportTargetTypeValue;
}) {
  const baseParams = new URLSearchParams();
  if (status) baseParams.set("status", status);
  if (targetType) baseParams.set("targetType", targetType);
  const buildHref = (p: number) => {
    const params = new URLSearchParams(baseParams);
    params.set("page", String(p));
    return `/admin/reports?${params.toString()}`;
  };
  return (
    <div className="flex items-center justify-between text-xs text-muted-foreground">
      <span>
        第 {page} / {totalPages} 页
      </span>
      <div className="flex gap-2">
        <Link
          href={buildHref(Math.max(1, page - 1))}
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
          href={buildHref(Math.min(totalPages, page + 1))}
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
