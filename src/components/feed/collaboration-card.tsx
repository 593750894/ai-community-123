import Link from "next/link";
import {
  Banknote,
  Briefcase,
  Clock,
  MapPin,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  COLLAB_LOCATION_LABEL,
  COLLAB_STATUS_LABEL,
  COLLAB_STATUS_TONE,
  COLLAB_WORK_MODE_LABEL,
  collabCategoryMeta,
  type CollabCategoryValue,
  type CollabLocationValue,
  type CollabStatusValue,
  type CollabWorkModeValue,
} from "@/lib/collaborations/categories";
import { authorTintFromName } from "@/lib/work-categories";

export type CollabCardItem = {
  id: string;
  title: string;
  description: string;
  category: CollabCategoryValue;
  workMode: CollabWorkModeValue;
  location: CollabLocationValue;
  status: CollabStatusValue;
  budget: string | null;
  tags: string[];
  createdAt: Date | string;
  author: {
    id: string;
    name: string;
    username: string;
    avatar: string | null;
    industryRole?: string | null;
  };
};

function formatRelative(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)} 天前`;
  return d.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

export function CollaborationCard({ item }: { item: CollabCardItem }) {
  const meta = collabCategoryMeta(item.category);
  const tint = authorTintFromName(item.author.name);
  const isClosed = item.status === "CLOSED";

  return (
    <Link
      href={`/collaboration/${item.id}`}
      className={cn(
        "group block surface-card surface-card-hover p-4 transition-all hover:-translate-y-0.5",
        isClosed && "opacity-60 hover:opacity-80",
      )}
    >
      <div className="flex items-start gap-4">
        {/* 分类色块 */}
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-lg border text-base",
            meta.tone,
          )}
          aria-hidden
        >
          {meta.emoji}
        </span>

        <div className="min-w-0 flex-1">
          {/* 标题行 + 状态 badge */}
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="line-clamp-1 text-sm font-medium text-foreground/95 group-hover:text-primary">
              {item.title}
            </h3>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                COLLAB_STATUS_TONE[item.status],
              )}
            >
              {COLLAB_STATUS_LABEL[item.status]}
            </span>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                meta.tone,
              )}
            >
              {meta.label}
            </span>
          </div>

          {/* 描述 */}
          <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-muted-foreground">
            {item.description}
          </p>

          {/* meta 行 */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Banknote className="size-3" />
              {item.budget ?? "面议"}
            </span>
            <Sep />
            <span className="inline-flex items-center gap-1">
              <Briefcase className="size-3" />
              {COLLAB_WORK_MODE_LABEL[item.workMode]}
            </span>
            <Sep />
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" />
              {COLLAB_LOCATION_LABEL[item.location]}
            </span>
            <Sep />
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />
              {formatRelative(item.createdAt)}
            </span>
          </div>

          {/* 标签 + 作者 */}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1">
              {item.tags.slice(0, 4).map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground"
                >
                  #{t}
                </span>
              ))}
              {item.tags.length > 4 && (
                <span className="text-[10px] text-muted-foreground/70">
                  +{item.tags.length - 4}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {item.author.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.author.avatar}
                  alt={item.author.name}
                  className="size-5 rounded-full border border-border/60"
                />
              ) : (
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-semibold text-black/70",
                    tint,
                  )}
                >
                  {item.author.name.slice(0, 1)}
                </span>
              )}
              <span className="truncate text-[11px] text-muted-foreground">
                {item.author.name}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function Sep() {
  return <span className="text-muted-foreground/40">·</span>;
}
