import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WorkflowItemForm } from "@/components/commerce/workflow-item-form";
import { requireUser } from "@/lib/auth/guard";
import { getMyWorkflowItem } from "@/lib/commerce/queries";
import {
  WORKFLOW_ITEM_STATUS_LABEL,
  formatPrice,
  type WorkflowItemStatusValue,
} from "@/lib/commerce/schemas";
import {
  deleteWorkflowItemAction,
  transitionWorkflowItemStatusAction,
} from "@/lib/commerce/seller-actions";

export const dynamic = "force-dynamic";

const CUID_RE = /^[a-z0-9]{20,30}$/;

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}

export default async function EditWorkflowItemPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  if (!CUID_RE.test(id)) notFound();
  const user = await requireUser(`/me/workflows/${id}/edit`);
  const item = await getMyWorkflowItem(id, user.id);
  if (!item) notFound();

  const { created } = await searchParams;
  const status = item.status as WorkflowItemStatusValue;
  const hasSales = item.salesCount > 0;

  return (
    <>
      <PageHeader
        eyebrow="编辑商品"
        title={item.title}
        description="编辑详情、价格与下载链接；右侧面板控制商品状态。"
        actions={
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<Link href="/me/workflows" />}
          >
            ← 我的商品
          </Button>
        }
      />

      {created === "1" && (
        <div className="mx-4 mt-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300 sm:mx-8">
          已创建为草稿；补齐下载链接 + 价格后即可上架。
        </div>
      )}

      <div className="grid gap-6 px-4 py-6 sm:px-8 sm:py-8 lg:grid-cols-[1fr_320px]">
        <div className="surface-card p-6">
          <WorkflowItemForm
            defaults={{
              id: item.id,
              title: item.title,
              description: item.description,
              coverUrl: item.coverUrl,
              downloadUrl: item.downloadUrl,
              priceCents: item.priceCents,
              category: item.category,
              tags: item.tags,
              toolStack: item.toolStack,
            }}
          />
        </div>

        <aside className="space-y-4">
          <section className="surface-card space-y-3 p-5">
            <h3 className="text-sm font-semibold">商品状态</h3>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">当前状态</span>
              <Badge
                variant={
                  status === "PUBLISHED"
                    ? "primary"
                    : status === "SOLD_OUT"
                      ? "destructive"
                      : "outline"
                }
              >
                {WORKFLOW_ITEM_STATUS_LABEL[status]}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">销量</span>
              <span className="tabular-nums">{item.salesCount}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">价格</span>
              <span className="tabular-nums text-primary">
                {formatPrice(item.priceCents, item.currency)}
              </span>
            </div>

            <div className="space-y-2 border-t border-border/40 pt-3">
              {status === "DRAFT" && (
                <form action={transitionWorkflowItemStatusAction}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="status" value="PUBLISHED" />
                  <button className="w-full rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/80">
                    上架到市集
                  </button>
                </form>
              )}
              {status === "PUBLISHED" && (
                <form action={transitionWorkflowItemStatusAction}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="status" value="ARCHIVED" />
                  <button className="w-full rounded-md border border-border/60 px-3 py-2 text-xs text-muted-foreground hover:text-foreground">
                    下架商品
                  </button>
                </form>
              )}
              {status === "ARCHIVED" && (
                <form action={transitionWorkflowItemStatusAction}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="status" value="PUBLISHED" />
                  <button className="w-full rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-primary hover:bg-primary/20">
                    重新上架
                  </button>
                </form>
              )}
              {!hasSales && (
                <form action={deleteWorkflowItemAction}>
                  <input type="hidden" name="id" value={item.id} />
                  <button className="w-full rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300 hover:bg-rose-500/20">
                    删除商品
                  </button>
                </form>
              )}
              {hasSales && (
                <p className="text-[11px] text-muted-foreground/70">
                  已有订单的商品不可删除；可通过下架来停止售卖。
                </p>
              )}
            </div>
          </section>

          {status === "PUBLISHED" && (
            <Link
              href={`/marketplace/${item.id}`}
              className="surface-card flex items-center gap-2 p-4 text-xs hover:border-primary/40"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="size-3.5" />
              在市集中查看
            </Link>
          )}
        </aside>
      </div>
    </>
  );
}
