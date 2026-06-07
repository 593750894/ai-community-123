import Link from "next/link";
import { notFound } from "next/navigation";
import { Layers, Sparkles, Tag, User } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { PurchaseButton } from "@/components/commerce/purchase-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { getPublicWorkflowItem } from "@/lib/commerce/queries";
import {
  WORKFLOW_ITEM_CATEGORY_LABEL,
  formatPrice,
  type WorkflowItemCategory,
} from "@/lib/commerce/schemas";
import { OrgAttributionBadge } from "@/components/publish/org-attribution-badge";

interface PageProps {
  params: Promise<{ id: string }>;
}

const CUID_RE = /^[a-z0-9]{20,30}$/;

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  if (!CUID_RE.test(id)) return { title: "工作流市集 · SeedLand · V" };
  const item = await getPublicWorkflowItem(id);
  if (!item) return { title: "工作流市集 · SeedLand · V" };
  return {
    title: `${item.title} · 工作流市集`,
    description: item.description.slice(0, 160),
  };
}

export const dynamic = "force-dynamic";

export default async function WorkflowItemDetailPage({ params }: PageProps) {
  const { id } = await params;
  if (!CUID_RE.test(id)) notFound();
  const [item, viewer] = await Promise.all([
    getPublicWorkflowItem(id),
    getCurrentUser(),
  ]);
  if (!item) notFound();

  const categoryLabel =
    WORKFLOW_ITEM_CATEGORY_LABEL[item.category as WorkflowItemCategory] ??
    item.category;
  const isSoldOut = item.status === "SOLD_OUT";
  const isOwnItem = !!viewer && viewer.id === item.seller.id;
  const purchaseDisabled = isSoldOut || isOwnItem;
  const disabledReason = isSoldOut
    ? "商品已售罄"
    : isOwnItem
      ? "无法购买自己的商品"
      : undefined;

  return (
    <>
      <PageHeader
        eyebrow="工作流市集"
        title={item.title}
        description={item.description.slice(0, 200)}
        actions={
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<Link href="/marketplace" />}
          >
            ← 返回市集
          </Button>
        }
      />

      <div className="grid gap-6 px-4 py-6 sm:px-8 sm:py-8 lg:grid-cols-[1fr_320px]">
        {/* 主体 */}
        <div className="space-y-5">
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-muted/40">
            {item.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.coverUrl}
                alt={item.title}
                className="absolute inset-0 size-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
                <Sparkles className="size-16" />
              </div>
            )}
          </div>

          <section className="surface-card space-y-2 p-5">
            <h2 className="text-sm font-semibold">商品介绍</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {item.description}
            </p>
          </section>

          {item.toolStack.length > 0 && (
            <section className="surface-card space-y-2 p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Layers className="size-3.5" />
                所需工具
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {item.toolStack.map((t) => (
                  <Badge key={t} variant="outline">
                    {t}
                  </Badge>
                ))}
              </div>
            </section>
          )}

          {item.tags.length > 0 && (
            <section className="surface-card space-y-2 p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Tag className="size-3.5" />
                标签
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {item.tags.map((t) => (
                  <Badge key={t}>{t}</Badge>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* 侧栏：价格 + 卖家信息 + 购买 CTA（Stage 10.2 接入） */}
        <aside className="space-y-4">
          <div className="surface-card sticky top-4 space-y-4 p-5">
            <div className="flex items-center justify-between">
              <Badge variant="primary">{categoryLabel}</Badge>
              {isSoldOut && <Badge variant="destructive">已售罄</Badge>}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-primary">
                {formatPrice(item.priceCents, item.currency)}
              </span>
            </div>
            <PurchaseButton
              payload={{ type: "WORKFLOW_PURCHASE", workflowItemId: item.id }}
              unauthenticated={!viewer}
              disabled={purchaseDisabled}
              disabledReason={disabledReason}
              label="立即购买"
              size="lg"
            />
            <p className="text-[11px] text-muted-foreground">
              已售出 {item.salesCount} 份 · 30 分钟内未付款订单将自动取消
            </p>
          </div>

          <Link
            href={`/profile/${item.seller.id}`}
            className="surface-card flex items-center gap-3 p-4 transition-colors hover:border-primary/40"
          >
            {item.seller.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.seller.avatar}
                alt={item.seller.name}
                className="size-10 rounded-full object-cover"
              />
            ) : (
              <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <User className="size-4" />
              </span>
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">
                {item.seller.name}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                @{item.seller.username}
              </div>
            </div>
          </Link>

          {item.organization && (
            <div className="surface-card space-y-2 p-4">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                由企业上架
              </p>
              <OrgAttributionBadge org={item.organization} size="sm" />
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
