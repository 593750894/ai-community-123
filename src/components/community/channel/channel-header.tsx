import Link from "next/link";
import { ArrowLeft, Calendar, MessageSquare, Sparkles, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ChannelDetail } from "@/types/community";

export function ChannelHeader({
  channel,
  signedIn,
}: {
  channel: ChannelDetail;
  signedIn: boolean;
}) {
  const publishHref = signedIn
    ? `/create-post?channelId=${channel.id}`
    : `/auth/login?next=/create-post?channelId=${channel.id}`;

  return (
    <header className="relative overflow-hidden border-b border-border/40 px-6 py-8 sm:px-8 sm:py-10">
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          background: `linear-gradient(135deg, ${channel.color}, transparent 70%)`,
        }}
      />
      <div className="absolute inset-0 bg-grid opacity-20" />

      <div className="relative space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Link
                href="/community"
                className="inline-flex items-center gap-1 rounded-full border border-border/40 bg-card/50 px-2.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
              >
                <ArrowLeft className="size-3" />
                社区
              </Link>
              <span className="text-[11px] text-muted-foreground/50">·</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium" style={{ borderColor: `${channel.color}40`, backgroundColor: `${channel.color}15`, color: channel.color }}>
                <span className="size-1.5 rounded-full shadow-[0_0_8px_currentColor]" style={{ backgroundColor: channel.color }} />
                {channel.slug}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span
                className="flex size-12 items-center justify-center rounded-xl text-2xl"
                style={{
                  backgroundColor: `${channel.color}20`,
                  color: channel.color,
                }}
              >
                {channel.icon ?? "#"}
              </span>
              <div>
                <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                  {channel.name}
                </h1>
                {channel.description && (
                  <p className="mt-0.5 max-w-xl text-sm text-muted-foreground">
                    {channel.description}
                  </p>
                )}
              </div>
            </div>
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
            >
              <Sparkles className="size-3.5" />
              在此频道发帖
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <MessageSquare className="size-3.5" />
            <span className="tabular-nums text-foreground/80">{channel.postCount}</span>
            <span>个帖子</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="size-3.5" />
            <span className="tabular-nums text-foreground/80">{channel.memberCount}</span>
            <span>位成员</span>
          </div>
          {channel.todayPostCount > 0 && (
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
              今日 +{channel.todayPostCount}
            </span>
          )}
          <div className="flex items-center gap-1.5">
            <Calendar className="size-3.5" />
            <span>创建于 {new Date(channel.createdAt).toLocaleDateString("zh-CN")}</span>
          </div>
          <div className="ml-auto">
            创建者：
            <Link
              href={`/profile/${channel.owner.id}`}
              className="ml-1 text-foreground/80 hover:text-primary"
            >
              {channel.owner.name}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
