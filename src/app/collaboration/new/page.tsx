import Link from "next/link";
import { ArrowLeft, Handshake } from "lucide-react";

import { requireUser } from "@/lib/auth/guard";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { CreateCollaborationForm } from "@/components/feed/create-collaboration-form";

export const dynamic = "force-dynamic";

export default async function CollaborationNewPage() {
  const user = await requireUser("/collaboration/new");

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        eyebrow="发布合作需求"
        title="发布合作 / 招募信息"
        description="把你的项目挂到合作市场。选择合作类型、说清楚交付物、留好联系方式，让对的人找到你。"
        actions={
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/collaboration" />}
          >
            <ArrowLeft className="size-3.5" />
            返回合作市场
          </Button>
        }
      />
      <div className="px-6 py-6 sm:px-8">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-xs text-primary">
            <Handshake className="size-3.5" />
            <span>
              当前以 <span className="font-medium">@{user.username}</span>{" "}
              的身份发布。需求将公开展示在合作市场，联系方式仅登录用户可见。
            </span>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card/30 p-6 sm:p-8">
            <CreateCollaborationForm />
          </div>
        </div>
      </div>
    </div>
  );
}
