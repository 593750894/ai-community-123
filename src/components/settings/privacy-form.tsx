"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function PrivacyForm({
  initial,
}: {
  initial: { isProfilePublic: boolean };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pub, setPub] = useState(initial.isProfilePublic);
  const [message, setMessage] = useState<{
    tone: "ok" | "err";
    text: string;
  } | null>(null);

  const toggle = (next: boolean) => {
    const prev = pub;
    setPub(next);
    start(async () => {
      const res = await fetch("/api/me/privacy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isProfilePublic: next }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setMessage({ tone: "ok", text: "已保存" });
        router.refresh();
      } else {
        setPub(prev);
        setMessage({
          tone: "err",
          text: data?.error?.message ?? "保存失败",
        });
      }
    });
  };

  return (
    <div className="space-y-2">
      <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/40 px-3 py-2">
        <div>
          <div className="text-sm">允许公开访问我的主页</div>
          <div className="text-[11px] text-muted-foreground">
            匿名访客（未登录）能看到你的主页 / 作品 / 帖子。
          </div>
        </div>
        <input
          type="checkbox"
          checked={pub}
          disabled={pending}
          onChange={(e) => toggle(e.target.checked)}
          aria-label="允许公开访问主页"
          className="size-4 accent-primary disabled:opacity-50"
        />
      </label>
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
