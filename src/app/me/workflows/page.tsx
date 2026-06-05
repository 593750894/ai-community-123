import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChip } from "@/components/ui/filter-chip";
import { requireUser } from "@/lib/auth/guard";
import { listMyWorkflowItems } from "@/lib/commerce/queries";
import {
  WORKFLOW_ITEM_STATUSES,
  WORKFLOW_ITEM_STATUS_LABEL,
  formatPrice,
  type WorkflowItemStatusValue,
} from "@/lib/commerce/schemas";
import {
  deleteWorkflowItemAction,
  transitionWorkflowItemStatusAction,
} from "@/lib/commerce/seller-actions";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ status?: string; page?: string }>;
}

function parseStatus(raw?: string): WorkflowItemStatusValue | undefined {
  if (!raw) return undefined;
  return (WORKFLOW_ITEM_STATUSES as readonly string[]).includes(raw)
    ? (raw as WorkflowItemStatusValue)
    : undefined;
}

export default async function MyWorkflowsPage({ searchParams }: PageProps) {
  const user = await requireUser("/me/workflows");
  const params = await searchParams;
  const status = parseStatus(params.status);
  const page = Math.max(1, Number(params.page) || 1);

  const { items, total, pageSize } = await listMyWorkflowItems(user.id, {
    status,
    page,
    pageSize: 20,
  });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <PageHeader
        eyebrow="我的工作流"
        title="管理你的市集商品"
        description="发布工作流、Prompt 包、节点图等数字商品；在编辑页随时上架 / 下架。"
        actions={
          <Button
            size="sm"
            nativeButton={false}
            render={<Link href="/me/workflows/new" />}
          >
            <Plus className="size-3.5" />
            新建商品
          </Button>
        }
      />

      <div className="space-y-4 px-4 py-5 sm:px-8 sm:py-6">
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            href="/me/workflows"
            active={!status}
            label="全部"
            count={total}
          />
          {WORKFLOW_ITEM_STATUSES.map((s) => (
            <FilterChip
              key={s}
              href={`/me/workflows?status=${s}`}
              active={status === s}
              label={WORKFLOW_ITEM_STATUS_LABEL[s]}
            />
          ))}
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title={status ? "没有匹配的商品" : "还没上架过商品"}
            description={
              status
                ? "切换筛选条件，或新建一个商品。"
                : "把你的工作流分享给社区 — 设置价格、上传封面，提交即可。"
            }
            action={
              <Button
                size="sm"
                nativeButton={false}
                render={<Link href="/me/workflows/new" />}
              >
                <Plus className="size-3.5" />
                新建商品
              </Button>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border/60">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">商品</th>
                  <th className="px-3 py-2 text-left">分类</th>
                  <th className="px-3 py-2 text-left">价格</th>
                  <th className="px-3 py-2 text-left">销量</th>
                  <th className="px-3 py-2 text-left">状态</th>
                  <th className="px-3 py-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-t border-border/40 hover:bg-muted/20"
                  >
                    <td className="px-3 py-2">
                      <Link
                        href={`/me/workflows/${item.id}/edit`}
                        className="block max-w-[320px] truncate font-medium hover:text-primary"
                      >
                        {item.title}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {item.category}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatPrice(item.priceCents, item.currency)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">
                      {item.salesCount}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-3 py-2">
                      <RowActions
                        id={item.id}
                        status={item.status as WorkflowItemStatusValue}
                        hasSales={item.salesCount > 0}
                      />
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
              page={Math.max(1, page - 1)}
              disabled={page <= 1}
              status={status}
              label="← 上一页"
            />
            <span className="text-muted-foreground">
              {page} / {totalPages}
            </span>
            <PagerLink
              page={Math.min(totalPages, page + 1)}
              disabled={page >= totalPages}
              status={status}
              label="下一页 →"
            />
          </nav>
        )}
      </div>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant: "primary" | "outline" | "destructive" | "default" =
    status === "PUBLISHED"
      ? "primary"
      : status === "DRAFT"
        ? "outline"
        : status === "ARCHIVED"
          ? "default"
          : status === "SOLD_OUT"
            ? "destructive"
            : "outline";
  return (
    <Badge variant={variant}>
      {WORKFLOW_ITEM_STATUS_LABEL[status as WorkflowItemStatusValue] ?? status}
    </Badge>
  );
}

function RowActions({
  id,
  status,
  hasSales,
}: {
  id: string;
  status: WorkflowItemStatusValue;
  hasSales: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Link
        href={`/me/workflows/${id}/edit`}
        className="rounded-md border border-border/60 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
      >
        编辑
      </Link>
      {status === "DRAFT" && (
        <form action={transitionWorkflowItemStatusAction}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="status" value="PUBLISHED" />
          <button className="rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-[11px] text-primary hover:bg-primary/20">
            上架
          </button>
        </form>
      )}
      {status === "PUBLISHED" && (
        <form action={transitionWorkflowItemStatusAction}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="status" value="ARCHIVED" />
          <button className="rounded-md border border-border/60 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground">
            下架
          </button>
        </form>
      )}
      {status === "ARCHIVED" && (
        <form action={transitionWorkflowItemStatusAction}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="status" value="PUBLISHED" />
          <button className="rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-[11px] text-primary hover:bg-primary/20">
            重新上架
          </button>
        </form>
      )}
      {!hasSales && (
        <form action={deleteWorkflowItemAction}>
          <input type="hidden" name="id" value={id} />
          <button className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-300 hover:bg-rose-500/20">
            删除
          </button>
        </form>
      )}
    </div>
  );
}

function PagerLink({
  page,
  disabled,
  status,
  label,
}: {
  page: number;
  disabled: boolean;
  status?: WorkflowItemStatusValue;
  label: string;
}) {
  const qs = new URLSearchParams();
  if (status) qs.set("status", status);
  if (page > 1) qs.set("page", String(page));
  const href = qs.toString()
    ? `/me/workflows?${qs.toString()}`
    : "/me/workflows";
  return (
    <Link
      href={href}
      aria-disabled={disabled}
      className="rounded-md border border-border/60 px-3 py-1 text-muted-foreground hover:text-foreground aria-disabled:pointer-events-none aria-disabled:opacity-40"
    >
      {label}
    </Link>
  );
}
