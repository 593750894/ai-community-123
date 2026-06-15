"use client";

import { Download, Loader2 } from "lucide-react";
import { useState } from "react";

/**
 * Stage 16.5：付费下载入口（紧凑款，用于订单列表 / 详情链。
 * 点击 → POST /api/orders/{orderNo}/download-url 拿短期签名 URL → 当前窗口跳转兑换。
 *
 * 错误处理：失败时仅打印一行小字，避免列表里整行 UI 抖动。
 */
export function SignedDownloadLink({ orderNo }: { orderNo: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    try {
      const resp = await fetch(`/api/orders/${orderNo}/download-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const body = (await resp.json()) as
        | { success: true; data: { url: string; expiresAt: string } }
        | { success: false; error: { code: string; message: string } };
      if (!resp.ok || body.success !== true) {
        const msg =
          (body as { error?: { message?: string } }).error?.message ??
          "签发下载链接失败";
        setError(msg);
        return;
      }
      window.location.href = body.data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络异常");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-600 hover:bg-emerald-500/20 disabled:opacity-50 dark:text-emerald-400"
      >
        {pending ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <Download className="size-3" />
        )}
        下载
      </button>
      {error && <span className="text-[10px] text-destructive">{error}</span>}
    </div>
  );
}
