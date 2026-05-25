import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requireUser } from "@/lib/auth/guard";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  CreatePostForm,
  type ChannelOption,
} from "@/components/feed/create-post-form";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getChannelOptions(): Promise<ChannelOption[]> {
  return prisma.channel.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, slug: true, icon: true },
  });
}

export default async function CreatePostPage({
  searchParams,
}: {
  searchParams: Promise<{ channelId?: string }>;
}) {
  const { channelId } = await searchParams;
  const next = channelId
    ? `/create-post?channelId=${channelId}`
    : "/create-post";
  await requireUser(next);
  const channels = await getChannelOptions();
  const defaultChannelId =
    channelId && channels.some((c) => c.id === channelId)
      ? channelId
      : undefined;

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        eyebrow="发布帖子"
        title="向社区发帖"
        description="选择一个频道、确认帖子类型，然后填写标题与正文。视频和图片链接可选，发布后会出现在对应频道。"
        actions={
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/community" />}
          >
            <ArrowLeft className="size-3.5" />
            返回社区
          </Button>
        }
      />

      <div className="px-6 py-6 sm:px-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-border/60 bg-card/30 p-6 sm:p-8">
          <CreatePostForm
            channels={channels}
            defaultChannelId={defaultChannelId}
          />
        </div>
      </div>
    </div>
  );
}
