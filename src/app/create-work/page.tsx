import Link from "next/link";
import { ArrowLeft, Upload } from "lucide-react";

import { requireUser } from "@/lib/auth/guard";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { CreateWorkForm } from "@/components/feed/create-work-form";

export const dynamic = "force-dynamic";

export default async function CreateWorkPage() {
  const user = await requireUser("/create-work");

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        eyebrow="发布作品"
        title="上传你的 AI 视频作品"
        description="填写标题、简介、封面与视频链接，选择作品类型并标记使用的 AI 工具。发布后将出现在作品广场。"
        actions={
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/showcase" />}
          >
            <ArrowLeft className="size-3.5" />
            返回作品广场
          </Button>
        }
      />

      <div className="px-6 py-6 sm:px-8">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-xs text-primary">
            <Upload className="size-3.5" />
            <span>
              当前以 <span className="font-medium">@{user.username}</span>{" "}
              的身份发布。作品将公开展示在作品广场。
            </span>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card/30 p-6 sm:p-8">
            <CreateWorkForm />
          </div>
        </div>
      </div>
    </div>
  );
}
