import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Coins,
  Handshake,
  MessageSquare,
  Play,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CountText } from "@/components/ui/count-text";
import { MoneyText } from "@/components/ui/money-text";
import { PillTag, type PillTagTint } from "@/components/ui/pill-tag";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { getOrganizationBySlug } from "@/lib/organizations/queries";
import {
  getOrganizationContentCounts,
  listOrganizationFeed,
  type OrgFeedItem,
} from "@/lib/organizations/content-attribution";
import { formatRelativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

const KIND_META: Record<
  OrgFeedItem["kind"],
  { label: string; icon: LucideIcon; tint: PillTagTint }
> = {
  post: {
    label: "讨论",
    icon: MessageSquare,
    tint: "blue",
  },
  work: {
    label: "作品",
    icon: Play,
    tint: "violet",
  },
  collab: {
    label: "合作",
    icon: Handshake,
    tint: "amber",
  },
  workflow: {
    label: "工作流商品",
    icon: Coins,
    tint: "emerald",
  },
};

function hrefFor(item: OrgFeedItem): string {
  switch (item.kind) {
    case "post":
      return `/post/${item.id}`;
    case "work":
      return `/showcase/${item.id}`;
    case "collab":
      return `/collaboration/${item.id}`;
    case "workflow":
      return `/marketplace/${item.id}`;
  }
}

/**
 * Stage 11.3：企业聚合内容页 `/organizations/[slug]/feed`。
 * 把企业归属的 posts + works + collaborations + workflow items 时间线合并展示。
 */
export default async function OrganizationFeedPage({ params }: PageProps) {
  const { slug } = await params;
  const org = await getOrganizationBySlug(slug);
  if (!org) notFound();

  const [items, counts] = await Promise.all([
    listOrganizationFeed(org.id, 60),
    getOrganizationContentCounts(org.id),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        eyebrow="企业内容"
        title={`${org.name} 的发布`}
        description="按时间倒序聚合该企业归属的全部讨论、作品、合作与商品。"
        actions={
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`/organizations/${org.slug}`} />}
          >
            <ArrowLeft className="size-3.5" />
            返回企业主页
          </Button>
        }
      />

      <div className="grid gap-3 px-4 pt-4 sm:px-8 sm:grid-cols-4">
        <StatTile label="讨论" value={counts.posts} icon={MessageSquare} />
        <StatTile label="作品" value={counts.works} icon={Play} />
        <StatTile label="合作" value={counts.collaborations} icon={Handshake} />
        <StatTile label="商品" value={counts.workflowItems} icon={Coins} />
      </div>

      <div className="px-4 py-6 sm:px-8">
        {items.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="还没有以企业身份发布的内容"
            description="企业成员可在发帖 / 发作品 / 发合作 / 上架工作流时切换发布身份。"
          />
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <FeedRow key={`${item.kind}-${item.id}`} item={item} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="surface-card flex items-center gap-3 p-4">
      <span className="flex size-8 items-center justify-center rounded-lg bg-muted/40 text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <CountText value={value} className="text-xl font-semibold" />
      </div>
    </div>
  );
}

function FeedRow({ item }: { item: OrgFeedItem }) {
  const meta = KIND_META[item.kind];
  const Icon = meta.icon;
  return (
    <li className="surface-card surface-card-hover">
      <Link href={hrefFor(item)} className="flex items-start gap-3 p-4">
        <PillTag tint={meta.tint} icon={Icon} size="sm">
          {meta.label}
        </PillTag>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-sm font-medium text-foreground/95">
            {item.title}
          </p>
          {item.kind === "post" && (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {item.excerpt}
            </p>
          )}
          {item.kind === "work" && item.thumbnailUrl && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              <Sparkles className="mr-1 inline size-3 align-text-bottom" />
              视频作品
            </p>
          )}
          {item.kind === "collab" && (
            <div className="mt-0.5">
              <Badge variant="outline">{item.status}</Badge>
            </div>
          )}
          {item.kind === "workflow" && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {item.coverUrl ? "含封面图 · " : ""}
              <MoneyText value={item.priceCents} className="text-primary" />
              {item.status === "SOLD_OUT" && (
                <span className="ml-2 text-destructive">已售罄</span>
              )}
            </p>
          )}
          <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>发布者 · @{item.author.username}</span>
            <span className="text-muted-foreground/40">·</span>
            <span>{formatRelativeTime(item.createdAt)}</span>
          </div>
        </div>
      </Link>
    </li>
  );
}
