"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AtSign,
  Bell,
  Bookmark,
  CheckCheck,
  Heart,
  MessageCircle,
  MessageSquare,
  Reply,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { NotificationItem } from "@/lib/notifications/queries";

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  POST_LIKE: Heart,
  WORK_LIKE: Heart,
  COMMENT_LIKE: Heart,
  POST_REPLY: MessageCircle,
  COMMENT_REPLY: Reply,
  BOOKMARK: Bookmark,
  MENTION: AtSign,
  COLLAB_REPLY: MessageSquare,
  MESSAGE: MessageSquare,
  FOLLOW: UserPlus,
  SYSTEM: Sparkles,
};

const TYPE_ACCENT: Record<string, string> = {
  POST_LIKE: "text-rose-300 bg-rose-500/10 border-rose-500/30",
  WORK_LIKE: "text-rose-300 bg-rose-500/10 border-rose-500/30",
  COMMENT_LIKE: "text-rose-300 bg-rose-500/10 border-rose-500/30",
  POST_REPLY: "text-cyan-300 bg-cyan-500/10 border-cyan-500/30",
  COMMENT_REPLY: "text-cyan-300 bg-cyan-500/10 border-cyan-500/30",
  BOOKMARK: "text-amber-300 bg-amber-500/10 border-amber-500/30",
  MENTION: "text-violet-300 bg-violet-500/10 border-violet-500/30",
  COLLAB_REPLY: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
  MESSAGE: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
  FOLLOW: "text-sky-300 bg-sky-500/10 border-sky-500/30",
  SYSTEM: "text-muted-foreground bg-muted/30 border-border/60",
};

type Bucket = "today" | "thisWeek" | "older";

function bucketOf(date: Date): Bucket {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (date >= startOfToday) return "today";
  const sevenDaysAgo = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);
  if (date >= sevenDaysAgo) return "thisWeek";
  return "older";
}

const BUCKET_LABEL: Record<Bucket, string> = {
  today: "今天",
  thisWeek: "本周",
  older: "更早",
};

interface NotificationListProps {
  initialItems: NotificationItem[];
  initialCursor: string | null;
  initialHasMore: boolean;
  initialUnreadCount: number;
}

interface ApiSuccess<T> {
  success: true;
  data: T;
}

export function NotificationList({
  initialItems,
  initialCursor,
  initialHasMore,
  initialUnreadCount,
}: NotificationListProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [isLoading, setIsLoading] = useState(false);
  const [, startTransition] = useTransition();
  const inflight = useRef(false);

  // 在打开通知页时无条件触发一次"全部已读"会让用户看不到上下文。
  // 因此选择：进入页面 + 单条点击时再标记；这里只追踪未读数。
  useEffect(() => {
    setUnreadCount(items.filter((n) => !n.readAt).length);
  }, [items]);

  const grouped = useMemo(() => {
    const buckets: Record<Bucket, NotificationItem[]> = {
      today: [],
      thisWeek: [],
      older: [],
    };
    for (const n of items) {
      buckets[bucketOf(new Date(n.createdAt))].push(n);
    }
    return buckets;
  }, [items]);

  async function loadMore() {
    if (!cursor || !hasMore || inflight.current) return;
    inflight.current = true;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/notifications?cursor=${encodeURIComponent(cursor)}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = (await res.json()) as ApiSuccess<{
        items: NotificationItem[];
        nextCursor: string | null;
        hasMore: boolean;
      }>;
      if (json.success) {
        setItems((prev) => [...prev, ...json.data.items]);
        setCursor(json.data.nextCursor);
        setHasMore(json.data.hasMore);
      }
    } finally {
      inflight.current = false;
      setIsLoading(false);
    }
  }

  async function markOne(id: string) {
    const target = items.find((n) => n.id === id);
    if (!target || target.readAt) return;
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date() } : n)),
    );
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    } catch {
      // 失败不回滚——下次进入页面会重新拉取真值
    }
  }

  async function markAll() {
    if (unreadCount === 0) return;
    const now = new Date();
    setItems((prev) =>
      prev.map((n) => (n.readAt ? n : { ...n, readAt: now })),
    );
    try {
      await fetch("/api/notifications/read-all", { method: "POST" });
      startTransition(() => router.refresh());
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {unreadCount > 0 ? (
            <>
              <span className="font-medium text-foreground">{unreadCount}</span> 条未读
            </>
          ) : (
            "全部已读"
          )}
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={unreadCount === 0}
          onClick={markAll}
        >
          <CheckCheck className="size-3.5" />
          全部标为已读
        </Button>
      </div>

      {(["today", "thisWeek", "older"] as Bucket[]).map((b) => {
        const rows = grouped[b];
        if (rows.length === 0) return null;
        return (
          <section key={b} className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {BUCKET_LABEL[b]}
            </h2>
            <ul className="divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/60 bg-card/30">
              {rows.map((n) => (
                <NotificationRow key={n.id} item={n} onClick={() => markOne(n.id)} />
              ))}
            </ul>
          </section>
        );
      })}

      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadMore}
            disabled={isLoading}
          >
            {isLoading ? "加载中…" : "加载更多"}
          </Button>
        </div>
      )}
    </div>
  );
}

function NotificationRow({
  item,
  onClick,
}: {
  item: NotificationItem;
  onClick: () => void;
}) {
  const Icon = TYPE_ICON[item.type] ?? Bell;
  const accent = TYPE_ACCENT[item.type] ?? TYPE_ACCENT.SYSTEM;
  const unread = !item.readAt;
  const href = item.link || "#";

  const body = (
    <div
      className={cn(
        "flex w-full items-start gap-3 px-4 py-3 transition-colors",
        unread ? "bg-primary/[0.04] hover:bg-primary/[0.08]" : "hover:bg-muted/30",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full border",
          accent,
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 text-sm leading-snug">
            {item.actor?.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.actor.avatar}
                alt={item.actor.name}
                className="mr-1.5 inline-block size-4 rounded-full border border-border/60 object-cover align-[-3px]"
              />
            ) : null}
            <span className={cn(unread ? "text-foreground" : "text-muted-foreground")}>
              {item.title}
            </span>
          </p>
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
            {formatRelativeTime(item.createdAt)}
          </span>
        </div>
        {item.body && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {item.body}
          </p>
        )}
      </div>
      {unread && (
        <span
          className="mt-1 size-2 shrink-0 rounded-full bg-primary shadow-[0_0_8px_currentColor]"
          aria-label="未读"
        />
      )}
    </div>
  );

  return (
    <li>
      {item.link ? (
        <Link href={href} onClick={onClick} className="block">
          {body}
        </Link>
      ) : (
        <button type="button" onClick={onClick} className="block w-full text-left">
          {body}
        </button>
      )}
    </li>
  );
}
