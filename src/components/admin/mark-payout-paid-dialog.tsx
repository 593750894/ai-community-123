"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  PAYOUT_METHOD_LABEL,
  formatPrice,
  type PayoutMethodValue,
} from "@/lib/commerce/schemas";

/**
 * Stage 10.5：admin 标记结算单已打款。
 *
 * 与 RefundDialog 同款 mount/unmount 套路：外层只持 open，内层 MarkForm 第一次挂载即把
 * 备注初值化（避免 react-hooks/set-state-in-effect lint）。
 *
 * 卖家未绑定收款账号时按钮 disabled + 引导文案。
 */
export interface MarkPayoutPaidDialogProps {
  payoutId: string;
  orderNo: string;
  netCents: number;
  currency: string;
  sellerUsername: string;
  account: {
    payoutMethod: PayoutMethodValue | null;
    payoutAccount: string | null;
    payoutName: string | null;
    hasAccount: boolean;
  };
}

export function MarkPayoutPaidDialog(props: MarkPayoutPaidDialogProps) {
  const [open, setOpen] = useState(false);
  if (!props.account.hasAccount) {
    return (
      <span
        title="卖家尚未绑定收款账号"
        className="cursor-not-allowed text-[10px] text-muted-foreground/60"
      >
        待卖家绑定账号
      </span>
    );
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-300 hover:bg-emerald-500/20"
      >
        标记已打款
      </button>
      {open && <MarkForm {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

function MarkForm({
  payoutId,
  orderNo,
  netCents,
  currency,
  sellerUsername,
  account,
  onClose,
}: MarkPayoutPaidDialogProps & { onClose: () => void }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const noteRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    noteRef.current?.focus();
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
    setSubmitting(true);
    try {
      const resp = await fetch(`/api/admin/payouts/${payoutId}/mark-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note.trim() || undefined }),
      });
      const json = (await resp.json().catch(() => ({}))) as {
        success?: boolean;
        error?: { message?: string };
      };
      if (!resp.ok || !json.success) {
        setErrMsg(json.error?.message ?? `操作失败（HTTP ${resp.status}）`);
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
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-border/60 bg-card p-5 shadow-2xl">
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Stage 10.5 · 结算
          </div>
          <h2 className="text-lg font-semibold">标记结算单已打款</h2>
          <p className="text-xs text-muted-foreground">
            订单 <span className="font-mono">{orderNo}</span> · 卖家 @{sellerUsername}
          </p>
        </div>

        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">结算净额</span>
              <span className="font-semibold tabular-nums text-emerald-300">
                {formatPrice(netCents, currency)}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-muted-foreground">收款渠道</span>
              <span>
                {account.payoutMethod
                  ? PAYOUT_METHOD_LABEL[account.payoutMethod]
                  : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">收款账号</span>
              <span className="font-mono text-[11px]">
                {account.payoutAccount ?? "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">收款人</span>
              <span>{account.payoutName ?? "—"}</span>
            </div>
          </div>

          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              备注（可选，存入审计日志 / 卖家可见）
            </span>
            <textarea
              ref={noteRef}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={200}
              placeholder="例：支付宝流水号 20260606xxxx"
              className="block w-full rounded-lg border border-border/60 bg-background px-2 py-1.5 text-xs outline-none focus:border-primary/60"
            />
          </label>

          <p className="text-[11px] text-amber-300">
            请先在第三方渠道完成实际转账，再在此点击确认；标记后无法撤销。
          </p>

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
            className="rounded-md border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "处理中…" : "确认已打款"}
          </button>
        </div>
      </div>
    </div>
  );
}
