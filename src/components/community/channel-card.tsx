import Link from "next/link";
import { ChevronRight, MessageSquare } from "lucide-react";

export interface ChannelCardProps {
  slug: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  postCount: number;
  lastActive?: string | null;
}

export function ChannelCard({
  slug,
  name,
  description,
  icon,
  color,
  postCount,
  lastActive,
}: ChannelCardProps) {
  return (
    <Link
      href={`/community/${slug}`}
      className="group surface-card relative flex flex-col overflow-hidden p-4 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card/60"
      style={{ borderTop: `2px solid ${color}50` }}
    >
      <div className="flex items-start justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-lg"
            style={{ backgroundColor: `${color}18`, color }}
          >
            {icon}
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold leading-tight">
              {name}
            </div>
          </div>
        </div>
        <ChevronRight className="size-4 shrink-0 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
      </div>

      <p className="mt-2 line-clamp-2 flex-1 text-xs leading-relaxed text-muted-foreground">
        {description}
      </p>

      <div className="mt-3 flex items-center gap-3 border-t border-border/30 pt-2.5 text-[11px] text-muted-foreground tabular-nums">
        <span className="inline-flex items-center gap-1">
          <MessageSquare className="size-3" />
          {postCount} 帖
        </span>
        {lastActive && (
          <span className="ml-auto truncate text-[11px] text-muted-foreground/60">
            {lastActive}
          </span>
        )}
      </div>
    </Link>
  );
}
