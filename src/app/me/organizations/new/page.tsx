import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { CreateOrganizationForm } from "@/components/organizations/create-organization-form";
import { requireUser } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export default async function NewOrganizationPage() {
  await requireUser("/me/organizations/new");

  return (
    <>
      <PageHeader
        eyebrow="新建企业"
        title="创建企业账号"
        description="填写基础信息即可建立企业；其它字段可稍后在设置页补全。"
        actions={
          <Link
            href="/me/organizations"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ← 返回我的企业
          </Link>
        }
      />

      <div className="px-4 py-5 sm:px-8 sm:py-6">
        <div className="rounded-xl border border-border bg-card/40 p-4">
          <CreateOrganizationForm />
        </div>
      </div>
    </>
  );
}
