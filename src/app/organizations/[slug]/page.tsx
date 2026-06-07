import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Building2,
  Globe2,
  Mail,
  Settings as SettingsIcon,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";
import {
  getOrganizationBySlug,
  getViewerMembership,
} from "@/lib/organizations/queries";
import {
  ORG_INDUSTRY_LABEL,
  ORG_ROLE_LABEL,
  type OrgIndustry,
} from "@/lib/organizations/schemas";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function OrganizationDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const [org, session] = await Promise.all([
    getOrganizationBySlug(slug),
    getSession(),
  ]);
  if (!org) notFound();

  const membership = session
    ? await getViewerMembership(org.id, session.userId)
    : null;
  const canManage =
    membership && (membership.role === "OWNER" || membership.role === "ADMIN");

  return (
    <div className="px-4 py-5 sm:px-8 sm:py-6">
      <div className="mb-4 flex items-center gap-3 text-xs text-muted-foreground">
        <Link href="/organizations" className="hover:text-foreground">
          ← 返回企业列表
        </Link>
      </div>

      <div className="rounded-xl border border-border/60 bg-card/40 p-6">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-muted/40">
            {org.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logo} alt={org.name} className="size-full object-cover" />
            ) : (
              <Building2 className="size-8 text-muted-foreground/70" />
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{org.name}</h1>
              {org.isVerified ? (
                <Badge variant="primary">✔ 已认证</Badge>
              ) : (
                <Badge variant="outline">未认证</Badge>
              )}
              {membership && (
                <Badge variant="success">{ORG_ROLE_LABEL[membership.role]}</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">@{org.slug}</p>
            {org.description && (
              <p className="max-w-2xl text-sm text-muted-foreground">
                {org.description}
              </p>
            )}
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              {org.industry && (
                <span>
                  行业 ·{" "}
                  {ORG_INDUSTRY_LABEL[org.industry as OrgIndustry] ?? org.industry}
                </span>
              )}
              {org.size && <span>规模 · {org.size}</span>}
              <span>成员 · {org._count.members}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {membership ? (
              <Button
                size="sm"
                variant="outline"
                nativeButton={false}
                render={<Link href={`/organizations/${org.slug}/members`} />}
              >
                <Users className="size-3.5" />
                成员列表
              </Button>
            ) : null}
            {canManage && (
              <Button
                size="sm"
                variant="outline"
                nativeButton={false}
                render={<Link href={`/organizations/${org.slug}/settings`} />}
              >
                <SettingsIcon className="size-3.5" />
                企业设置
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Card title="联系方式" icon={Mail}>
          {org.contactEmail ? (
            <a
              className="text-sm text-primary hover:underline"
              href={`mailto:${org.contactEmail}`}
            >
              {org.contactEmail}
            </a>
          ) : (
            <p className="text-xs text-muted-foreground">未填写联系邮箱。</p>
          )}
        </Card>
        <Card title="官网" icon={Globe2}>
          {org.website ? (
            <a
              className="break-all text-sm text-primary hover:underline"
              href={org.website}
              target="_blank"
              rel="noreferrer"
            >
              {org.website}
            </a>
          ) : (
            <p className="text-xs text-muted-foreground">未填写企业官网。</p>
          )}
        </Card>
        <Card title="所有者" icon={Building2} className="sm:col-span-2">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-full bg-muted/40 text-xs text-muted-foreground">
              {org.owner.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={org.owner.avatar}
                  alt={org.owner.name}
                  className="size-full rounded-full object-cover"
                />
              ) : (
                org.owner.name.slice(0, 1)
              )}
            </div>
            <div>
              <Link
                href={`/profile/${org.owner.id}`}
                className="text-sm hover:text-primary"
              >
                {org.owner.name}
              </Link>
              <p className="text-[11px] text-muted-foreground">
                @{org.owner.username}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Card({
  title,
  icon: Icon,
  className,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={[
        "rounded-xl border border-border/60 bg-card/40 p-4",
        className ?? "",
      ].join(" ")}
    >
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {Icon && <Icon className="size-3.5" />} {title}
      </div>
      <div>{children}</div>
    </section>
  );
}
