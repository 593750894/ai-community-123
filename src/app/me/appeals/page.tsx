import Link from "next/link";
import { Gavel } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChip } from "@/components/ui/filter-chip";
import { SubmitAppealForm } from "@/components/me/submit-appeal-form";
import { CancelAppealButton } from "@/components/me/cancel-appeal-button";
import { requireUser } from "@/lib/auth/guard";
import {
  APPEAL_STATUSES,
  APPEAL_STATUS_LABEL,
  CONTENT_TARGET_LABEL,
  CONTENT_TARGET_TYPES,
  type AppealStatus,
  type ContentTargetType,
} from "@/lib/content/schemas";
import {
  getAppealEligibility,
  listMyAppeals,
} from "@/lib/content/appeals";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    status?: string;
    page?: string;
    targetType?: string;
    targetId?: string;
  }>;
}

function parseStatus(raw?: string): AppealStatus | null | undefined {
  if (!raw) return undefined;
  if (raw === "ALL") return null;
  return (APPEAL_STATUSES as readonly string[]).includes(raw)
    ? (raw as AppealStatus)
    : undefined;
}

function parseTargetType(raw?: string): ContentTargetType | null {
  if (!raw) return null;
  return (CONTENT_TARGET_TYPES as readonly string[]).includes(raw)
    ? (raw as ContentTargetType)
    : null;
}

export default async function MyAppealsPage({ searchParams }: PageProps) {
  const user = await requireUser("/me/appeals");
  const params = await searchParams;
  const statusFilter = parseStatus(params.status);
  const page = Math.max(1, Number(params.page) || 1);
  const currentStatus = params.status ?? "ALL";

  const { items, total, pageSize } = await listMyAppeals(user.id, {
    status: statusFilter ?? undefined,
    page,
    pageSize: 20,
  });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // 内嵌「发起申诉」入口：从 CONTENT_REMOVED 通知 link 跳过来时携带 targetType + targetId。
  const submitTargetType = parseTargetType(params.targetType);
  const submitTargetId = params.targetId?.trim() ?? "";
  const submitContext =
    submitTargetType && submitTargetId
      ? await getAppealEligibility(submitTargetType, submitTargetId, user.id)
      : null;

  const buildHref = (overrides: Partial<{ status: string; page: number }>) => {
    const sp = new URLSearchParams();
    if (params.status && overrides.status === undefined) sp.set("status", params.status);
    if (overrides.status) sp.set("status", overrides.status);
    if (overrides.page && overrides.page > 1) sp.set("page", String(overrides.page));
    const qs = sp.toString();
    return qs ? `/me/appeals?${qs}` : "/me/appeals";
  };

  return (
    <>
      <PageHeader
        eyebrow="我的申诉"
        title="申诉中心"
        description="对被管理员或审核员下架的内容发起复核申请。审核结果会发送通知，已通过的内容会自动恢复。"
      />

      <div className="space-y-5 px-4 py-5 sm:px-8 sm:py-6">
        {submitContext && submitTargetType && (
          <SubmitContextPanel
            ctx={submitContext}
            targetType={submitTargetType}
            targetId={submitTargetId}
          />
        )}

        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            href={buildHref({ status: "ALL", page: 1 })}
            active={currentStatus === "ALL"}
            label="全部"
            count={total}
          />
          {APPEAL_STATUSES.map((s) => (
            <FilterChip
              key={s}
              href={buildHref({ status: s, page: 1 })}
              active={currentStatus === s}
              label={APPEAL_STATUS_LABEL[s]}
            />
          ))}
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon={Gavel}
            title="还没有申诉记录"
            description="若你的帖子 / 作品 / 评论 / 合作被审核者下架，会收到通知并附带申诉入口。"
          />
        ) : (
          <ul className="space-y-3">
            {items.map((row) => (
              <li
                key={row.id}
                className="rounded-xl border border-border bg-card/40 p-4 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        row.status === "APPROVED"
                          ? "success"
                          : row.status === "PENDING"
                            ? "warning"
                            : row.status === "REJECTED"
                              ? "destructive"
                              : "outline"
                      }
                    >
                      {APPEAL_STATUS_LABEL[row.status]}
                    </Badge>
                    <span className="text-muted-foreground">
                      {CONTENT_TARGET_LABEL[row.targetType]} · 提交于{" "}
                      <span className="tabular-nums">
                        {new Date(row.createdAt).toLocaleDateString("zh-CN")}
                      </span>
                    </span>
                  </div>
                  {row.status === "PENDING" && (
                    <CancelAppealButton appealId={row.id} />
                  )}
                </div>

                <p className="mt-2 line-clamp-2 break-words text-muted-foreground">
                  内容摘要：{row.contentSnippet ?? "（内容已不可读）"}
                </p>
                <details className="mt-2">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    查看申诉理由
                  </summary>
                  <p className="mt-1 whitespace-pre-wrap rounded-md border border-border bg-muted/20 px-2 py-1.5">
                    {row.reason}
                  </p>
                </details>

                {row.reviewNote && row.status !== "PENDING" && (
                  <p className="mt-2 text-muted-foreground">
                    审核备注：
                    <span className="text-foreground">{row.reviewNote}</span>
                  </p>
                )}
              </li>
            ))}
          </ul>
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

        <p className="rounded-md border border-border bg-card/30 px-3 py-2 text-[11px] text-muted-foreground">
          一条内容在任意时点最多可有一条审核中的申诉。审核结束后如认为结果不当，可补充证据重新提交。
        </p>
      </div>
    </>
  );
}

function SubmitContextPanel({
  ctx,
  targetType,
  targetId,
}: {
  ctx: Awaited<ReturnType<typeof getAppealEligibility>>;
  targetType: ContentTargetType;
  targetId: string;
}) {
  if (ctx.state === "no-content") {
    return (
      <Notice tone="warning">
        未找到目标内容（{CONTENT_TARGET_LABEL[targetType]} ·{" "}
        <code className="font-mono">{targetId}</code>）。可能已被彻底删除或链接失效。
      </Notice>
    );
  }
  if (ctx.state === "not-owner") {
    return (
      <Notice tone="warning">
        只能对自己的内容发起申诉。该 {CONTENT_TARGET_LABEL[targetType]} 不属于你。
      </Notice>
    );
  }
  if (ctx.state === "restored") {
    return (
      <Notice tone="success">
        ✔ 该 {CONTENT_TARGET_LABEL[targetType]} 当前处于公开状态，无需申诉。
      </Notice>
    );
  }
  if (ctx.state === "pending") {
    return (
      <Notice tone="default">
        你已对该 {CONTENT_TARGET_LABEL[targetType]} 提交申诉，审核中——请等待结果，可在下方列表里查看。
      </Notice>
    );
  }
  if (ctx.state === "denied-retry-limit") {
    return (
      <Notice tone="warning">
        该 {CONTENT_TARGET_LABEL[targetType]} 申诉已多次被驳回，不能再次发起申诉。如有异议请联系管理员。
      </Notice>
    );
  }
  if (!ctx.target) return null;
  return (
    <SubmitAppealForm
      targetType={targetType}
      targetId={targetId}
      contentSnippet={ctx.target.titleSnippet}
      deletionReason={ctx.target.deletionReason}
      retry={ctx.state === "rejected-but-can-retry"}
    />
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "default" | "warning" | "success";
  children: React.ReactNode;
}) {
  const cls =
    tone === "warning"
      ? "border-tag-amber-fg/30 bg-tag-amber-bg/15 text-tag-amber-fg"
      : tone === "success"
        ? "border-tag-emerald-fg/30 bg-tag-emerald-bg/15 text-tag-emerald-fg"
        : "border-border bg-card/40 text-muted-foreground";
  return (
    <div className={`rounded-xl border px-3 py-2 text-xs ${cls}`}>{children}</div>
  );
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
