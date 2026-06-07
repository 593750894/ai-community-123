import Link from "next/link";
import { Coins, Sparkles, Tag } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  WORKFLOW_ITEM_CATEGORY_LABEL,
  WORKFLOW_ITEM_STATUS_LABEL,
  formatPrice,
  type WorkflowItemCategory,
  type WorkflowItemStatusValue,
} from "@/lib/commerce/schemas";
import {
  OrgAttributionBadge,
  type OrgAttribution,
} from "@/components/publish/org-attribution-badge";

export interface WorkflowItemCardProps {
  item: {
    id: string;
    title: string;
    description: string;
    coverUrl: string | null;
    priceCents: number;
    currency: string;
    category: string;
    tags: string[];
    toolStack: string[];
    salesCount: number;
    status: string;
    seller: {
      id: string;
      username: string;
      name: string;
      avatar: string | null;
    };
    organization?: OrgAttribution | null;
  };
  /** 卖家自己看时显示 DRAFT/ARCHIVED 状态徽章，公共场不显示。 */
  showStatus?: boolean;
  /** 自定义详情链接前缀（卖家页跳 /me/workflows/[id]/edit）。 */
  href?: string;
}

export function WorkflowItemCard({
  item,
  showStatus = false,
  href,
}: WorkflowItemCardProps) {
  const linkHref = href ?? `/marketplace/${item.id}`;
  const categoryLabel =
    WORKFLOW_ITEM_CATEGORY_LABEL[item.category as WorkflowItemCategory] ??
    item.category;
  const statusLabel =
    WORKFLOW_ITEM_STATUS_LABEL[item.status as WorkflowItemStatusValue] ??
    item.status;
  const isSoldOut = item.status === "SOLD_OUT";

  return (
    <Card
      variant="default"
      interactive
      className="flex h-full flex-col overflow-hidden"
    >
      <Link href={linkHref} className="flex h-full flex-col">
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted/40">
          {item.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.coverUrl}
              alt={item.title}
              className="absolute inset-0 size-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
              <Sparkles className="size-10" />
            </div>
          )}
          <div className="absolute left-2 top-2 flex flex-wrap gap-1">
            <Badge variant="primary">{categoryLabel}</Badge>
            {showStatus && <Badge variant="outline">{statusLabel}</Badge>}
            {isSoldOut && !showStatus && (
              <Badge variant="destructive">售罄</Badge>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4">
          <h3 className="line-clamp-2 text-sm font-semibold leading-tight">
            {item.title}
          </h3>
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {item.description}
          </p>

          {item.toolStack.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.toolStack.slice(0, 3).map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                >
                  <Tag className="size-2.5" />
                  {t}
                </span>
              ))}
            </div>
          )}

          <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/40 pt-2 text-xs">
            <div className="flex min-w-0 flex-1 items-center gap-1.5 text-muted-foreground">
              <span className="truncate">
                by{" "}
                <span className="text-foreground/80">
                  @{item.seller.username}
                </span>
              </span>
              {item.organization && (
                <OrgAttributionBadge org={item.organization} size="xs" />
              )}
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-primary">
              <Coins className="size-3" />
              {formatPrice(item.priceCents, item.currency)}
            </span>
          </div>
        </div>
      </Link>
    </Card>
  );
}
