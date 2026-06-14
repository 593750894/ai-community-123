import Link from "next/link";
import { Building2, Plus } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChip } from "@/components/ui/filter-chip";
import { listPublicOrganizations } from "@/lib/organizations/queries";
import {
  ORG_INDUSTRIES,
  ORG_INDUSTRY_LABEL,
  type OrgIndustry,
} from "@/lib/organizations/schemas";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    industry?: string;
    verifiedOnly?: string;
    page?: string;
  }>;
}

function parseIndustry(raw?: string): OrgIndustry | undefined {
  if (!raw) return undefined;
  return (ORG_INDUSTRIES as readonly string[]).includes(raw)
    ? (raw as OrgIndustry)
    : undefined;
}

export default async function OrganizationsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const industry = parseIndustry(params.industry);
  const verifiedOnly = params.verifiedOnly === "1";
  const page = Math.max(1, Number(params.page) || 1);

  const { items, total, pageSize } = await listPublicOrganizations({
    q,
    industry,
    verifiedOnly,
    page,
    pageSize: 24,
  });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const buildHref = (overrides: Partial<{
    q: string;
    industry: string;
    verifiedOnly: string;
    page: number;
  }>) => {
    const sp = new URLSearchParams();
    if (q && overrides.q === undefined) sp.set("q", q);
    if (overrides.q) sp.set("q", overrides.q);
    if (industry && overrides.industry === undefined) sp.set("industry", industry);
    if (overrides.industry) sp.set("industry", overrides.industry);
    if (verifiedOnly && overrides.verifiedOnly === undefined) sp.set("verifiedOnly", "1");
    if (overrides.verifiedOnly === "1") sp.set("verifiedOnly", "1");
    if (overrides.page && overrides.page > 1) sp.set("page", String(overrides.page));
    const qs = sp.toString();
    return qs ? `/organizations?${qs}` : "/organizations";
  };

  return (
    <>
      <PageHeader
        eyebrow="企业"
        title="企业账号"
        description="发现合作工作室、行业团队，或将你自己的企业入驻社区。"
        actions={
          <Button
            size="sm"
            nativeButton={false}
            render={<Link href="/me/organizations/new" />}
          >
            <Plus className="size-3.5" />
            创建企业
          </Button>
        }
      />

      <div className="space-y-4 px-4 py-5 sm:px-8 sm:py-6">
        <form
          method="get"
          className="flex flex-wrap items-center gap-2"
          action="/organizations"
        >
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="搜索企业名称或简介…"
            className="h-9 w-full max-w-sm rounded-md border border-border bg-background/40 px-2 text-sm outline-none focus:border-primary/50 sm:w-72"
          />
          {industry && <input type="hidden" name="industry" value={industry} />}
          {verifiedOnly && <input type="hidden" name="verifiedOnly" value="1" />}
          <Button type="submit" size="sm" variant="outline">
            搜索
          </Button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            href={buildHref({ industry: "", page: 1 })}
            active={!industry}
            label="全部行业"
          />
          {ORG_INDUSTRIES.map((ind) => (
            <FilterChip
              key={ind}
              href={buildHref({ industry: ind, page: 1 })}
              active={industry === ind}
              label={ORG_INDUSTRY_LABEL[ind]}
            />
          ))}
          <span className="mx-1 text-muted-foreground/40">·</span>
          <FilterChip
            href={buildHref({ verifiedOnly: verifiedOnly ? "" : "1", page: 1 })}
            active={verifiedOnly}
            label="仅显示认证"
          />
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="没有匹配的企业"
            description={q ? "试试其他关键词或清空筛选。" : "还没有企业入驻 — 来做第一个吧。"}
            action={
              <Button size="sm" nativeButton={false} render={<Link href="/me/organizations/new" />}>
                <Plus className="size-3.5" />
                创建企业
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((org) => (
              <OrgCard key={org.id} org={org} />
            ))}
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

function OrgCard({
  org,
}: {
  org: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    logo: string | null;
    industry: string | null;
    isVerified: boolean;
    _count: { members: number };
  };
}) {
  return (
    <Link
      href={`/organizations/${org.slug}`}
      className="group flex flex-col gap-3 rounded-xl border border-border bg-card/40 p-4 transition-colors hover:border-primary/40"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/40 text-lg">
          {org.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logo} alt={org.name} className="size-full object-cover" />
          ) : (
            <Building2 className="size-5 text-muted-foreground/70" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium group-hover:text-primary">
              {org.name}
            </span>
            {org.isVerified && (
              <Badge variant="primary" size="sm">
                ✔ 认证
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">@{org.slug}</p>
        </div>
      </div>
      {org.description && (
        <p className="line-clamp-2 text-xs text-muted-foreground">{org.description}</p>
      )}
      <div className="mt-auto flex items-center justify-between text-[11px] text-muted-foreground/80">
        <span>
          {org.industry
            ? ORG_INDUSTRY_LABEL[org.industry as OrgIndustry] ?? org.industry
            : "未填写行业"}
        </span>
        <span>{org._count.members} 名成员</span>
      </div>
    </Link>
  );
}

function PagerLink({ href, disabled, label }: { href: string; disabled: boolean; label: string }) {
  if (disabled) {
    return <span className="cursor-default px-3 py-1 text-muted-foreground/50">{label}</span>;
  }
  return (
    <Link href={href} className="rounded-md border border-border px-3 py-1 text-muted-foreground hover:text-foreground">
      {label}
    </Link>
  );
}
