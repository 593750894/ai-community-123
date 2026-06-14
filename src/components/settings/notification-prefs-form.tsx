"use client";

import { useState, useTransition } from "react";

import {
  NOTIFICATION_TYPE_DESCRIPTION,
  NOTIFICATION_TYPE_LABEL,
} from "@/lib/notifications/preferences-meta";
import type { NotificationType } from "@/generated/prisma/client";

type PrefMap = Record<NotificationType, boolean>;

// Stage 9：每行一个 toggle。乐观更新；失败时回滚。
// SYSTEM 行禁用，标记「无法关闭」。

export function NotificationPrefsForm({
  types,
  initial,
}: {
  types: readonly string[];
  initial: PrefMap;
}) {
  const [map, setMap] = useState<PrefMap>(initial);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{
    tone: "ok" | "err";
    text: string;
  } | null>(null);

  const toggle = (type: NotificationType, next: boolean) => {
    if (type === "SYSTEM") return;
    const prev = map[type];
    setMap({ ...map, [type]: next });
    start(async () => {
      const res = await fetch("/api/me/notification-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, enabled: next }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setMessage({ tone: "ok", text: "已保存" });
      } else {
        setMap({ ...map, [type]: prev });
        setMessage({
          tone: "err",
          text: data?.error?.message ?? "保存失败",
        });
      }
    });
  };

  return (
    <div className="space-y-2">
      {types.map((raw) => {
        const t = raw as NotificationType;
        const enabled = map[t];
        const disabled = t === "SYSTEM";
        return (
          <label
            key={t}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/40 px-3 py-2"
          >
            <div className="min-w-0">
              <div className="text-sm">
                {NOTIFICATION_TYPE_LABEL[t]}
                {disabled && (
                  <span className="ml-2 rounded bg-muted/60 px-1 text-[10px] text-muted-foreground">
                    无法关闭
                  </span>
                )}
              </div>
              <div className="truncate text-[11px] text-muted-foreground">
                {NOTIFICATION_TYPE_DESCRIPTION[t]}
              </div>
            </div>
            <input
              type="checkbox"
              checked={enabled}
              disabled={disabled || pending}
              onChange={(e) => toggle(t, e.target.checked)}
              aria-label={NOTIFICATION_TYPE_LABEL[t]}
              className="size-4 accent-primary disabled:opacity-50"
            />
          </label>
        );
      })}
      {message && (
        <div
          className={
            message.tone === "ok"
              ? "text-[11px] text-tag-emerald-fg"
              : "text-[11px] text-rose-400"
          }
        >
          {message.text}
        </div>
      )}
    </div>
  );
}
