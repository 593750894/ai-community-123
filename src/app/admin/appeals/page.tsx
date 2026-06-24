import Link from "next/link";
import { Gavel } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { ReviewAppealDialog } from "@/components/admin/review-appeal-dialog";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChip } from "@/components/ui/filter-chip";
import { requireAdmin } from "@/lib/auth/guard";
import {
  APPEAL_STATUSES,
  APPEAL_STATUS_LABEL,
  CONTENT_TARGET_LABEL,
  type AppealStatus,
} from "@/lib/content/schemas";
import { listAdminAppeals } from "@/lib/content/appeals";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}

function parseStatus(raw?: string): AppealStatus | null | undefined {
  if (!raw) return undefined;
  if (raw === "ALL") return null;
  return (APPEAL_STATUSES as readonly string[]).includes(raw)
    ? (raw as AppealStatus)
    : undefined;
}

export default async function AdminAppealsPage({ searchParams }: PageProps) {
  await requireAdmin("/admin/appeals");
  const params = await searchParams;
  const statusFilter = parseStatus(params.status);
  const q = (params.q ?? "").trim() || undefined;
  const page = Math.max(1, Number(params.page) || 1);
  const currentStatus = params.status ?? "PENDING";

  const { items, total, pendingTotal, pageSize } = await listAdminAppeals({
    status: statusFilter ?? "PENDING",
    q,
    page,
    pageSize: 20,
  });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const buildHref = (overrides: Partial<{
    status: string;
    q: string;
    page: number;
  }>) => {
    const sp = new URLSearchParams();
    if (params.status && overrides.status === undefined) sp.set("status", params.status);
    if (overrides.status) sp.set("status", overrides.status);
    if (q && overrides.q === undefined) sp.set("q", q);
    if (overrides.q) sp.set("q", overrides.q);
    if (overrides.page && overrides.page > 1) sp.set("page", String(overrides.page));
    const qs = sp.toString();
    return qs ? `/admin/appeals?${qs}` : "/admin/appeals";
  };

  return (
    <>
      <PageHeader
        eyebrow="内容申诉"
        title="申诉队列"
        description={`当前待审 ${pendingTotal} 笔。通过申诉会恢复内容并通知作者；驳回时必须填写备注。`}
      />

      <div className="space-y-4 px-4 py-5 sm:px-8 sm:py-6">
        <form
          method="get"
          action="/admin/appeals"
          className="flex flex-wrap items-center gap-2"
        >
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="搜索申诉人用户名/姓名 或 目标 ID…"
            className="h-9 w-72 rounded-md border border-border bg-background/40 px-2 text-sm outline-none focus:border-primary/50"
          />
          {currentStatus !== "PENDING" && (
            <input type="hidden" name="status" value={currentStatus} />
          )}
          <button className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted/60">
            搜索
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            href={buildHref({ status: "PENDING", page: 1 })}
            active={currentStatus === "PENDING"}
            label="待审"
            count={pendingTotal}
          />
          {APPEAL_STATUSES.filter((s) => s !== "PENDING").map((s) => (
            <FilterChip
              key={s}
              href={buildHref({ status: s, page: 1 })}
              active={currentStatus === s}
              label={APPEAL_STATUS_LABEL[s]}
            />
          ))}
          <FilterChip
            href={buildHref({ status: "ALL", page: 1 })}
            active={currentStatus === "ALL"}
            label="全部"
            count={total}
          />
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon={Gavel}
            title="当前筛选下没有申诉"
            description="切换筛选或等待新的申诉提交。"
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">申诉人</th>
                  <th className="px-3 py-2 text-left">类型</th>
                  <th className="px-3 py-2 text-left">摘要</th>
                  <th className="px-3 py-2 text-left">状态</th>
                  <th className="px-3 py-2 text-left">提交时间</th>
                  <th className="px-3 py-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-border align-top hover:bg-muted/20"
                  >
                    <td className="px-3 py-2">
                      <Link
                        href={`/profile/${row.appellant.id}`}
                        className="font-medium hover:text-primary"
                      >
                        {row.appellant.name}
                      </Link>
                      <p className="text-[10px] text-muted-foreground/70">
                        @{row.appellant.username}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {CONTENT_TARGET_LABEL[row.targetType]}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      <p className="line-clamp-2 max-w-md">
                        {row.contentSnippet ?? (
                          <span className="text-muted-foreground/60">
                            内容已不可读
                          </span>
                        )}
                      </p>
                      {row.contentStillDeleted === false && row.status === "PENDING" && (
                        <p className="text-[10px] text-tag-amber-fg">
                          注意：内容当前未处于下架状态
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-3 py-2 text-muted-foreground tabular-nums">
                      {new Date(row.createdAt).toISOString().slice(0, 10)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {row.status === "PENDING" ? (
                          <ReviewAppealDialog
                            appealId={row.id}
                            snapshot={{
                              targetType: row.targetType,
                              targetId: row.targetId,
                              contentSnippet: row.contentSnippet,
                              reason: row.reason,
                              appellant: row.appellant,
                              createdAt:
                                row.createdAt instanceof Date
                                  ? row.createdAt.toISOString()
                                  : String(row.createdAt),
                            }}
                          />
                        ) : (
                          <span className="text-[11px] text-muted-foreground/70">
                            {row.reviewedAt
                              ? new Date(row.reviewedAt).toISOString().slice(0, 10)
                              : "—"}
                            {row.reviewedBy ? ` · ${row.reviewedBy.name}` : ""}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <nav className="flex items-center justify-center gap-3 text-xs">
            <PagerLink
              href={buildHref({ page: Math.max(1, page - 1) })}
              disabled={page <= 1}
              label="← 上一页"
            />
            <span className="text-muted-foreground">
              {page} / {totalPages}
            </span>
            <PagerLink
              href={buildHref({ page: Math.min(totalPages, page + 1) })}
              disabled={page >= totalPages}
              label="下一页 →"
            />
          </nav>
        )}
      </div>
    </>
  );
}

function StatusBadge({ status }: { status: AppealStatus }) {
  const variant =
    status === "APPROVED"
      ? "success"
      : status === "PENDING"
        ? "warning"
        : status === "REJECTED"
          ? "destructive"
          : "outline";
  return <Badge variant={variant}>{APPEAL_STATUS_LABEL[status]}</Badge>;
}

function PagerLink({
  href,
  disabled,
  label,
}: {
  href: string;
  disabled: boolean;
  label: string;
}) {
  if (disabled) {
    return (
      <span className="cursor-default px-3 py-1 text-muted-foreground/50">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="rounded-md border border-border px-3 py-1 text-muted-foreground hover:text-foreground"
    >
      {label}
    </Link>
  );
}
