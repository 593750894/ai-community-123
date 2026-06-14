"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MoneyText } from "@/components/ui/money-text";
import { formatPrice } from "@/lib/commerce/schemas";

/**
 * Stage 10.4：Admin 退款弹窗（每行表格独立挂载）。
 *
 * 设计：
 *   - 默认金额 = 剩余可退（amountCents - refundCents）；admin 可改成部分退款。
 *   - 提交走 fetch POST /api/admin/orders/:orderNo/refund；成功后 router.refresh() 刷 SSR。
 *   - 内部表单抽到 <RefundForm>，靠 React mount/unmount 控制状态初始化 —
 *     避免 useEffect 里 setState（仓库 lint 规则 react-hooks/set-state-in-effect）。
 *   - Modal scaffolding（backdrop / Esc / focus trap / scroll lock / ✕）由
 *     <Dialog> 原语托管；此处只关心业务逻辑。
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
        className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-1 text-[11px] text-destructive hover:bg-destructive/20"
      >
        退款
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <RefundForm
          {...props}
          remaining={remaining}
          onClose={() => setOpen(false)}
        />
      </Dialog>
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
    <DialogContent ariaLabelledBy="refund-dialog-title" size="md">
      <DialogHeader>
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Stage 10.4 · 退款
        </div>
        <DialogTitle id="refund-dialog-title">订单退款</DialogTitle>
        <p className="text-xs text-muted-foreground">
          订单 <span className="font-mono">{orderNo}</span> · 渠道{" "}
          {paymentMethodLabel}
        </p>
      </DialogHeader>

      <DialogBody className="space-y-3">
        <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">订单金额</span>
            <MoneyText value={amountCents} currency={currency} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">已退</span>
            <MoneyText value={refundCents} currency={currency} />
          </div>
          <div className="mt-1 flex items-center justify-between border-t border-border pt-1">
            <span className="font-medium">剩余可退</span>
            <MoneyText
              value={remaining}
              currency={currency}
              className="font-semibold text-tag-cyan-fg"
            />
          </div>
        </div>

        <label className="block space-y-1">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            本次退款金额（元）
          </span>
          <input
            data-autofocus
            type="number"
            step="0.01"
            min="0"
            max={(remaining / 100).toFixed(2)}
            value={amountYuan}
            onChange={(e) => setAmountYuan(e.target.value)}
            className="block h-9 w-full rounded-lg border border-border bg-background px-2 text-sm tabular-nums outline-none focus:border-primary/60"
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
            className="block w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary/60"
          />
        </label>

        {errMsg && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
            {errMsg}
          </div>
        )}
      </DialogBody>

      <DialogFooter>
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        >
          取消
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="rounded-full border border-destructive/40 bg-destructive/15 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/25 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "处理中…" : "确认退款"}
        </button>
      </DialogFooter>
    </DialogContent>
  );
}
