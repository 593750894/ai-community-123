import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { CreateGroupForm } from "@/components/messages/create-group-form";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function NewGroupPage() {
  const session = await getSession();
  if (!session) {
    redirect(`/auth/login?next=${encodeURIComponent("/messages/new")}`);
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        eyebrow="新建群聊"
        title="发起群聊"
        description="把多位创作者拉到同一个会话里，便于协作与项目沟通。"
        actions={
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/messages" />}
          >
            <ArrowLeft className="size-3.5" />
            返回消息列表
          </Button>
        }
      />
      <div className="px-4 py-5 sm:px-8 sm:py-6">
        <div className="max-w-xl rounded-2xl border border-border/60 bg-card/30 p-5 sm:p-6">
          <CreateGroupForm />
        </div>
      </div>
    </div>
  );
}
