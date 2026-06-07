import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { WorkflowItemForm } from "@/components/commerce/workflow-item-form";
import { requireUser } from "@/lib/auth/guard";
import { listMyPostableOrganizations } from "@/lib/organizations/content-attribution";

export const dynamic = "force-dynamic";

export default async function NewWorkflowItemPage() {
  const user = await requireUser("/me/workflows/new");
  const organizations = await listMyPostableOrganizations(user.id);

  return (
    <>
      <PageHeader
        eyebrow="新建商品"
        title="上架你的工作流 / Prompt 包"
        description="创建后保存为草稿；补齐下载链接 + 价格 > 0 后即可一键上架到市集。"
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
      <div className="px-4 py-6 sm:px-8 sm:py-8">
        <div className="surface-card mx-auto max-w-3xl p-6">
          <WorkflowItemForm organizations={organizations} />
        </div>
      </div>
    </>
  );
}
