import Link from "next/link";
import { BadgeCheck } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { ReviewVerificationDialog } from "@/components/admin/review-verification-dialog";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChip } from "@/components/ui/filter-chip";
import {
  ORG_VERIFICATION_STATUSES,
  ORG_VERIFICATION_STATUS_LABEL,
  type OrgVerificationStatusValue,
} from "@/lib/organizations/schemas";
import { listAdminVerifications } from "@/lib/organizations/verification";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    status?: string;
    q?: string;
    page?: string;
  }>;
}

function parseStatus(raw?: string): OrgVerificationStatusValue | null | undefined {
  if (!raw) return undefined; // 默认 PENDING（查询层处理）
  if (raw === "ALL") return null; // 查询层 null = 不过滤
  return (ORG_VERIFICATION_STATUSES as readonly string[]).includes(raw)
    ? (raw as OrgVerificationStatusValue)
    : undefined;
}

export default async function AdminVerificationsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const statusFilter = parseStatus(params.status);
  const q = (params.q ?? "").trim() || null;
  const page = Math.max(1, Number(params.page) || 1);

  const { items, total, pendingTotal, pageSize } = await listAdminVerifications({
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
    return qs ? `/admin/organizations/verifications?${qs}` : "/admin/organizations/verifications";
  };

  const currentStatus = params.status ?? "PENDING";

  return (
    <>
      <PageHeader
        eyebrow="企业认证"
        title="企业认证审核"
        description={`当前待审 ${pendingTotal} 笔。审核通过后企业公开页会显示 ✔ 认证徽标。`}
      />

      <div className="space-y-4 px-4 py-5 sm:px-8 sm:py-6">
        <form
          method="get"
          action="/admin/organizations/verifications"
          className="flex flex-wrap items-center gap-2"
        >
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="搜索企业名 / slug / 注册号…"
            className="h-9 w-64 rounded-md border border-border bg-background/40 px-2 text-sm outline-none focus:border-primary/50"
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
          {ORG_VERIFICATION_STATUSES.filter((s) => s !== "PENDING").map((s) => (
            <FilterChip
              key={s}
              href={buildHref({ status: s, page: 1 })}
              active={currentStatus === s}
              label={ORG_VERIFICATION_STATUS_LABEL[s]}
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
            icon={BadgeCheck}
            title="当前筛选下没有申请"
            description="切换筛选或等待新的认证申请提交。"
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">企业</th>
                  <th className="px-3 py-2 text-left">营业执照名称</th>
                  <th className="px-3 py-2 text-left">注册号</th>
                  <th className="px-3 py-2 text-left">提交人</th>
                  <th className="px-3 py-2 text-left">状态</th>
                  <th className="px-3 py-2 text-left">提交时间</th>
                  <th className="px-3 py-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-border hover:bg-muted/20"
                  >
                    <td className="px-3 py-2">
                      <Link
                        href={`/organizations/${row.slug}`}
                        className="font-medium hover:text-primary"
                      >
                        {row.name}
                      </Link>
                      <p className="text-[10px] text-muted-foreground/80">
                        @{row.slug}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {row.verificationName ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground tabular-nums">
                      {row.verificationRegNo ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {row.owner?.name ? (
                        <Link
                          href={`/profile/${row.owner.id}`}
                          className="hover:text-primary"
                        >
                          {row.owner.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                      {row.owner?.username && (
                        <p className="text-[10px] text-muted-foreground/70">
                          @{row.owner.username}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={row.verificationStatus as OrgVerificationStatusValue} />
                    </td>
                    <td className="px-3 py-2 text-muted-foreground tabular-nums">
                      {row.verificationSubmittedAt
                        ? new Date(row.verificationSubmittedAt)
                            .toISOString()
                            .slice(0, 10)
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {row.verificationLicenseUrl && (
                          <a
                            href={row.verificationLicenseUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                          >
                            查看执照
                          </a>
                        )}
                        {row.verificationStatus === "PENDING" && (
                          <ReviewVerificationDialog
                            orgId={row.id}
                            orgName={row.name}
                            details={{
                              name: row.verificationName,
                              regNo: row.verificationRegNo,
                              rep: row.verificationRep,
                              licenseUrl: row.verificationLicenseUrl,
                              contact: row.verificationContact,
                              note: row.verificationNote,
                            }}
                          />
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

function StatusBadge({ status }: { status: OrgVerificationStatusValue }) {
  const variant =
    status === "APPROVED"
      ? "success"
      : status === "PENDING"
        ? "warning"
        : status === "REJECTED"
          ? "destructive"
          : "outline";
  return <Badge variant={variant}>{ORG_VERIFICATION_STATUS_LABEL[status]}</Badge>;
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
    return <span className="cursor-default px-3 py-1 text-muted-foreground/50">{label}</span>;
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
