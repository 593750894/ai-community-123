"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Stage 12.4：会话免打扰开关。
 * 当前未静音 → 弹快捷菜单（1h / 8h / 24h / 7d）。
 * 静音中 → 显示「免打扰中（剩余 Xh）」按钮，点一下取消。
 */
const MUTE_PRESETS = [
  { hours: 1, label: "1 小时" },
  { hours: 8, label: "8 小时" },
  { hours: 24, label: "24 小时" },
  { hours: 24 * 7, label: "7 天" },
];

export function MuteToggle({
  conversationId,
  isMuted,
  mutedHours,
}: {
  conversationId: string;
  isMuted: boolean;
  mutedHours: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(hours: number) {
    setPending(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/mute`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hours }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        window.alert(json?.error?.message ?? `操作失败 (${res.status})`);
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (isMuted) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => void submit(0)}
        disabled={pending}
        title="点击取消免打扰"
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <BellOff className="size-3.5 text-amber-300" />
        )}
        免打扰 {mutedHours > 0 ? `(${mutedHours}h)` : ""}
      </Button>
    );
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Bell className="size-3.5" />
        )}
        免打扰
      </Button>
      {open && (
        <div
          className="absolute right-0 top-full z-30 mt-1 w-40 overflow-hidden rounded-lg border border-border/60 bg-popover shadow-lg"
          onMouseLeave={() => setOpen(false)}
        >
          {MUTE_PRESETS.map((p) => (
            <button
              key={p.hours}
              type="button"
              onClick={() => void submit(p.hours)}
              disabled={pending}
              className="block w-full px-3 py-2 text-left text-xs text-foreground hover:bg-muted/40 disabled:opacity-60"
            >
              静音 {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
