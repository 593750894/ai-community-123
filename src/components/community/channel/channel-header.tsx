import Link from "next/link";
import {
  ArrowLeft,
  CalendarPlus,
  MessageSquare,
  Sparkles,
  Tag,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ChannelDetail, ChannelStats } from "@/types/community";
import { getPublishLabel } from "@/lib/community/channel-categories";

const CHANNEL_COPY: Record<string, string> = {
  "ai-video-tools":
    "讨论 Seedance、Kling、Veo、Runway、Pika、ComfyUI 等工具的真实体验、参数技巧和工作流组合。",
  "ai-short-drama":
    "分享 AI 短剧策划、分镜、角色一致性、镜头控制、配音、剪辑和商业化经验。",
  "ai-comic-drama":
    "交流 AI 漫画剧集制作、风格化角色与多帧叙事的创意探索和技术实践。",
  general:
    "AI 视频创作者的日常交流据点，分享见解、交流经验、碰撞灵感。",
  "newbie-qa":
    "刚接触 AI 视频？在这里提问，社区老手帮你避坑、快速上手。",
  "prompts-workflow":
    "分享提示词模板、ComfyUI 节点组合、批量生成流程和视频自动化方案。",
  comfyui:
    "ComfyUI 节点配置、工作流分享与视频生成管线搭建的专属讨论区。",
  "seedance-kling-veo":
    "Seedance、Kling、Veo 等主流 AI 视频模型的参数调优、效果对比与实战技巧。",
  showcase:
    "展示你的 AI 视频作品，获得社区反馈、灵感碰撞与曝光机会。",
  "project-collab":
    "寻找合作伙伴，组建团队，共同完成 AI 视频创意项目。",
  hiring:
    "发布 AI 视频制作需求、接单信息，连接创作者与客户。",
  news:
    "AI 视频行业最新动态、模型发布、政策解读与市场趋势汇总。",
  "tool-reviews":
    "AI 视频工具深度评测、横向对比与选型建议，帮你选对工具。",
  "business-cases":
    "AI 视频商业化落地案例、变现路径与盈利模式经验分享。",
};

export function ChannelHeader({
  channel,
  stats,
  signedIn,
}: {
  channel: ChannelDetail;
  stats: ChannelStats;
  signedIn: boolean;
}) {
  const publishHref = signedIn
    ? `/create-post?channelId=${channel.id}`
    : `/auth/login?next=/create-post?channelId=${channel.id}`;

  const publishLabel = getPublishLabel(channel.slug);
  const auxiliaryCopy = CHANNEL_COPY[channel.slug];

  return (
    <header className="relative overflow-hidden border-b border-border/40 px-6 py-10 sm:px-8 sm:py-12">
      {/* Multi-layer gradient background matching community hero */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-fuchsia-500/6" />
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          background: `linear-gradient(135deg, ${channel.color}, transparent 60%)`,
        }}
      />
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div
        className="absolute -top-24 left-1/3 size-80 rounded-full blur-3xl"
        style={{ backgroundColor: `${channel.color}14` }}
      />

      <div className="relative space-y-5">
        {/* Breadcrumb + channel badge */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/community"
            className="inline-flex items-center gap-1 rounded-full border border-border/40 bg-card/50 px-2.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
          >
            <ArrowLeft className="size-3" />
            社区总览
          </Link>
          {channel.category && (
            <>
              <span className="text-[11px] text-muted-foreground/50">/</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-border/30 bg-muted/40 px-2.5 py-0.5 text-[11px] text-muted-foreground">
                <Tag className="size-2.5" />
                {channel.category}
              </span>
            </>
          )}
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium"
            style={{
              borderColor: `${channel.color}40`,
              backgroundColor: `${channel.color}15`,
              color: channel.color,
            }}
          >
            <span
              className="size-1.5 rounded-full"
              style={{
                backgroundColor: channel.color,
                boxShadow: `0 0 8px ${channel.color}`,
              }}
            />
            频道
          </span>
        </div>

        {/* Title row */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              {channel.icon && (
                <span
                  className="flex size-14 items-center justify-center rounded-xl border text-3xl shadow-lg sm:size-16 sm:text-4xl"
                  style={{
                    backgroundColor: `${channel.color}18`,
                    borderColor: `${channel.color}30`,
                    color: channel.color,
                    boxShadow: `0 0 24px ${channel.color}18`,
                  }}
                >
                  {channel.icon}
                </span>
              )}
              <div>
                <h1 className="text-xl font-bold tracking-tight sm:text-2xl lg:text-3xl">
                  {channel.name}
                </h1>
                {channel.description && (
                  <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
                    {channel.description}
                  </p>
                )}
              </div>
            </div>

            {auxiliaryCopy && (
              <p className="max-w-2xl rounded-lg border border-primary/10 bg-primary/5 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
                {auxiliaryCopy}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/community" />}
            >
              <ArrowLeft className="size-3.5" />
              全部频道
            </Button>
            <Button
              size="sm"
              nativeButton={false}
              render={<Link href={publishHref} />}
              className="shadow-sm shadow-primary/25"
            >
              <Sparkles className="size-3.5" />
              {publishLabel}
            </Button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border/30 bg-card/30 px-4 py-2.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <MessageSquare className="size-3.5 text-cyan-400" />
            <span className="tabular-nums font-semibold text-foreground/90">
              {stats.postCount}
            </span>
            <span>个帖子</span>
          </div>
          <div className="h-3 w-px bg-border/60" />
          <div className="flex items-center gap-1.5">
            <Users className="size-3.5 text-emerald-400" />
            <span className="tabular-nums font-semibold text-foreground/90">
              {stats.creatorCount}
            </span>
            <span>位创作者</span>
          </div>
          {stats.todayPostCount > 0 && (
            <>
              <div className="h-3 w-px bg-border/60" />
              <div className="flex items-center gap-1.5">
                <CalendarPlus className="size-3.5 text-amber-400" />
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                  今日 +{stats.todayPostCount}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
