"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { formatPrice } from "@/lib/commerce/schemas";

/**
 * Stage 10.4：Admin 退款弹窗（每行表格独立挂载）。
 *
 * 设计：
 *   - 默认金额 = 剩余可退（amountCents - refundCents）；admin 可改成部分退款。
 *   - 提交走 fetch POST /api/admin/orders/:orderNo/refund；成功后 router.refresh() 刷 SSR。
 *   - 内部表单抽到 <RefundForm>，靠 React mount/unmount 控制状态初始化 —
 *     避免 useEffect 里 setState（仓库 lint 规则 react-hooks/set-state-in-effect）。
 */

export interface RefundDialogProps {
  orderNo: string;
  amountCents: number;
  refundCents: number;
  currency: string;
  /** 渠道展示用，避免误退 mock 单。 */
  paymentMethodLabel: string;
}

export function RefundDialog(props: RefundDialogProps) {
  const [open, setOpen] = useState(false);
  const remaining = Math.max(0, props.amountCents - props.refundCents);
  if (remaining <= 0) {
    return (
      <span className="text-[10px] text-muted-foreground/60">已退完</span>
    );
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-300 hover:bg-rose-500/20"
      >
        退款
      </button>
      {open && (
        <RefundForm
          {...props}
          remaining={remaining}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function RefundForm({
  orderNo,
  amountCents,
  refundCents,
  currency,
  paymentMethodLabel,
  remaining,
  onClose,
}: RefundDialogProps & { remaining: number; onClose: () => void }) {
  const router = useRouter();
  // 因为 RefundForm 在 open=true 时才挂载，初始 state = 当前 remaining；
  // 无需 useEffect 同步 prop。
  const [amountYuan, setAmountYuan] = useState(() =>
    (remaining / 100).toFixed(2),
  );
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // 挂载后 focus + 监听 Escape。两个均为合法外部副作用（DOM API + 事件订阅）。
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  async function submit() {
    setErrMsg(null);
    const yuan = Number(amountYuan);
    if (!Number.isFinite(yuan) || yuan <= 0) {
      setErrMsg("金额必须大于 0");
      return;
    }
    const cents = Math.round(yuan * 100);
    if (cents > remaining) {
      setErrMsg(`金额不能超过剩余可退 ${formatPrice(remaining, currency)}`);
      return;
    }
    setSubmitting(true);
    try {
      const resp = await fetch(`/api/admin/orders/${orderNo}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents: cents,
          reason: reason.trim() || undefined,
        }),
      });
      const json = (await resp.json().catch(() => ({}))) as {
        success?: boolean;
        error?: { message?: string };
      };
      if (!resp.ok || !json.success) {
        setErrMsg(json.error?.message ?? `退款失败（HTTP ${resp.status}）`);
        return;
      }
      onClose();
      router.refresh();
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "网络异常，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={(e) => {
        // 点遮罩关闭，但点内容不传播。
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-border/60 bg-card p-5 shadow-2xl">
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Stage 10.4 · 退款
          </div>
          <h2 className="text-lg font-semibold">订单退款</h2>
          <p className="text-xs text-muted-foreground">
            订单 <span className="font-mono">{orderNo}</span> · 渠道{" "}
            {paymentMethodLabel}
          </p>
        </div>

        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">订单金额</span>
              <span className="tabular-nums">
                {formatPrice(amountCents, currency)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">已退</span>
              <span className="tabular-nums">
                {formatPrice(refundCents, currency)}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between border-t border-border/40 pt-1">
              <span className="font-medium">剩余可退</span>
              <span className="tabular-nums font-semibold text-cyan-300">
                {formatPrice(remaining, currency)}
              </span>
            </div>
          </div>

          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              本次退款金额（元）
            </span>
            <input
              ref={inputRef}
              type="number"
              step="0.01"
              min="0"
              max={(remaining / 100).toFixed(2)}
              value={amountYuan}
              onChange={(e) => setAmountYuan(e.target.value)}
              className="block h-9 w-full rounded-lg border border-border/60 bg-background px-2 text-sm tabular-nums outline-none focus:border-primary/60"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              退款原因（可选，会进 PSP + 审计日志）
            </span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={200}
              placeholder="例：买家申请，商品不符"
              className="block w-full rounded-lg border border-border/60 bg-background px-2 py-1.5 text-xs outline-none focus:border-primary/60"
            />
          </label>

          {errMsg && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-300">
              {errMsg}
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-md border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          >
            取消
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="rounded-md border border-rose-500/40 bg-rose-500/15 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "处理中…" : "确认退款"}
          </button>
        </div>
      </div>
    </div>
  );
}
