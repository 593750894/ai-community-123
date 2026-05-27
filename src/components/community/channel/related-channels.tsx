import Link from "next/link";
import { Hash, MessageSquare, Users } from "lucide-react";

import type { ChannelOverview } from "@/types/community";

export function RelatedChannels({
  channels,
}: {
  channels: ChannelOverview[];
}) {
  if (channels.length === 0) return null;

  return (
    <section className="surface-card p-4">
      <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-foreground/90">
        <Hash className="size-3.5 text-violet-400" />
        推荐相关频道
      </div>
      <ul className="space-y-1">
        {channels.map((ch) => (
          <li key={ch.id}>
            <Link
              href={`/community/${ch.id}`}
              className="group flex items-start gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-muted/40"
            >
              <span
                className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg text-base"
                style={{
                  backgroundColor: `${ch.color}20`,
                  color: ch.color,
                }}
              >
                {ch.icon ?? "#"}
              </span>
              <div className="min-w-0 flex-1">
                <span className="truncate text-sm font-medium group-hover:text-primary">
                  {ch.name}
                </span>
                {ch.description && (
                  <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                    {ch.description}
                  </p>
                )}
                <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground tabular-nums">
                  <span className="inline-flex items-center gap-0.5">
                    <MessageSquare className="size-2.5" />
                    {ch.postCount}
                  </span>
                  <span className="inline-flex items-center gap-0.5">
                    <Users className="size-2.5" />
                    {ch.memberCount}
                  </span>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
