import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { OrganizationSettingsForm } from "@/components/organizations/organization-settings-form";
import { VerificationPanel } from "@/components/organizations/verification-panel";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/guard";
import {
  getOrganizationBySlug,
  getViewerMembership,
} from "@/lib/organizations/queries";
import { type OrgVerificationStatusValue } from "@/lib/organizations/schemas";
import {
  deleteOrganizationAction,
  leaveOrganizationAction,
} from "@/lib/organizations/server-actions";
import { getOrgVerification } from "@/lib/organizations/verification";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ created?: string }>;
}

export default async function OrganizationSettingsPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const user = await requireUser(`/organizations/${slug}/settings`);
  const org = await getOrganizationBySlug(slug);
  if (!org) notFound();

  const membership = await getViewerMembership(org.id, user.id);
  if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
    redirect(`/organizations/${slug}`);
  }
  const isOwner = membership.role === "OWNER";
  const verification = await getOrgVerification(org.id);

  return (
    <>
      <PageHeader
        eyebrow={org.name}
        title="企业设置"
        description="编辑企业基础信息；slug 创建后不可修改。"
        actions={
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<Link href={`/organizations/${org.slug}`} />}
          >
            ← 返回主页
          </Button>
        }
      />

      <div className="space-y-6 px-4 py-5 sm:px-8 sm:py-6">
        {sp.created === "1" && (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
            企业已创建。可继续完善信息或前往成员页邀请伙伴。
          </div>
        )}

        <section className="rounded-xl border border-border/60 bg-card/40 p-4">
          <h2 className="mb-3 text-sm font-medium">基础信息</h2>
          <OrganizationSettingsForm
            defaults={{
              id: org.id,
              slug: org.slug,
              name: org.name,
              description: org.description,
              logo: org.logo,
              website: org.website,
              industry: org.industry,
              size: org.size,
              contactEmail: org.contactEmail,
            }}
          />
        </section>

        <section className="rounded-xl border border-border/60 bg-card/40 p-4">
          <h2 className="mb-3 text-sm font-medium">企业认证</h2>
          <p className="mb-3 text-[11px] text-muted-foreground">
            提交营业执照与法人信息进行企业认证；通过后将在公开页展示 ✔ 认证徽标。
          </p>
          {verification && (
            <VerificationPanel
              defaults={{
                id: org.id,
                slug: org.slug,
                status: verification.verificationStatus as OrgVerificationStatusValue,
                isVerified: verification.isVerified,
                name: verification.verificationName,
                regNo: verification.verificationRegNo,
                rep: verification.verificationRep,
                licenseUrl: verification.verificationLicenseUrl,
                contact: verification.verificationContact,
                note: verification.verificationNote,
                reviewNote: verification.verificationReviewNote,
                submittedAt: verification.verificationSubmittedAt,
                reviewedAt: verification.verificationReviewedAt,
              }}
            />
          )}
        </section>

        <section className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4">
          <h2 className="mb-2 text-sm font-medium text-rose-300">高级操作</h2>
          {isOwner ? (
            <form
              action={deleteOrganizationAction}
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <input type="hidden" name="id" value={org.id} />
              <div>
                <p className="text-xs text-rose-300">解散企业</p>
                <p className="text-[11px] text-rose-200/80">
                  解散后所有成员资格、邀请记录均会被移除，操作不可恢复。
                </p>
              </div>
              <button className="rounded-md border border-rose-500/40 bg-rose-500/15 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-500/25">
                解散企业
              </button>
            </form>
          ) : (
            <form
              action={leaveOrganizationAction}
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <input type="hidden" name="id" value={org.id} />
              <div>
                <p className="text-xs text-rose-300">退出企业</p>
                <p className="text-[11px] text-rose-200/80">
                  退出后将失去管理员权限。重新加入需所有者再次邀请。
                </p>
              </div>
              <button className="rounded-md border border-rose-500/40 bg-rose-500/15 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-500/25">
                退出企业
              </button>
            </form>
          )}
        </section>
      </div>
    </>
  );
}
