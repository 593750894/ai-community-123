import Link from "next/link";
import { Building2, Inbox, Plus, Settings as SettingsIcon, Users } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUser } from "@/lib/auth/guard";
import {
  getPendingInviteCount,
  listMyOrganizations,
} from "@/lib/organizations/queries";
import {
  ORG_INDUSTRY_LABEL,
  ORG_ROLE_LABEL,
  type OrgIndustry,
} from "@/lib/organizations/schemas";

export const dynamic = "force-dynamic";

export default async function MyOrganizationsPage() {
  const user = await requireUser("/me/organizations");
  const [items, pendingCount] = await Promise.all([
    listMyOrganizations(user.id),
    getPendingInviteCount(user.id),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="我的企业"
        title="我所在的企业"
        description="管理你所属或拥有的企业账号。"
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href="/me/organizations/invites" />}
            >
              <Inbox className="size-3.5" />
              邀请收件箱
              {pendingCount > 0 && (
                <span className="ml-1 rounded-full bg-primary/15 px-1.5 text-[10px] text-primary">
                  {pendingCount}
                </span>
              )}
            </Button>
            <Button
              size="sm"
              nativeButton={false}
              render={<Link href="/me/organizations/new" />}
            >
              <Plus className="size-3.5" />
              创建企业
            </Button>
          </div>
        }
      />

      <div className="space-y-4 px-4 py-5 sm:px-8 sm:py-6">
        {items.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="还没有加入任何企业"
            description="创建一个企业，或等待被邀请加入。"
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  size="sm"
                  nativeButton={false}
                  render={<Link href="/me/organizations/new" />}
                >
                  <Plus className="size-3.5" /> 创建企业
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  nativeButton={false}
                  render={<Link href="/organizations" />}
                >
                  浏览企业
                </Button>
              </div>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map(({ role, organization: org }) => (
              <div
                key={org.id}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card/40 p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/40">
                    {org.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={org.logo}
                        alt={org.name}
                        className="size-full object-cover"
                      />
                    ) : (
                      <Building2 className="size-5 text-muted-foreground/70" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link
                        href={`/organizations/${org.slug}`}
                        className="truncate text-sm font-medium hover:text-primary"
                      >
                        {org.name}
                      </Link>
                      {org.isVerified && (
                        <Badge variant="primary" size="sm">
                          认证
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">@{org.slug}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground/80">
                      {org.industry
                        ? ORG_INDUSTRY_LABEL[org.industry as OrgIndustry] ??
                          org.industry
                        : "未填写行业"}
                      {" · "}
                      {org._count.members} 名成员
                    </p>
                  </div>
                </div>
                <div className="mt-auto flex items-center justify-between">
                  <Badge variant={role === "OWNER" ? "primary" : "outline"}>
                    {ORG_ROLE_LABEL[role]}
                  </Badge>
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/organizations/${org.slug}/members`}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      <Users className="size-3" /> 成员
                    </Link>
                    {(role === "OWNER" || role === "ADMIN") && (
                      <Link
                        href={`/organizations/${org.slug}/settings`}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        <SettingsIcon className="size-3" /> 设置
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
