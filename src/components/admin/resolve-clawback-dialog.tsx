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

type ResolveTo = "DEDUCTED" | "MANUAL" | "WAIVED";

const OPTIONS: Array<{
  value: ResolveTo;
  label: string;
  hint: string;
  noteRequired: boolean;
}> = [
  {
    value: "DEDUCTED",
    label: "已抵扣下次结算",
    hint: "已在某笔 PENDING / AVAILABLE 结算单上扣减；备注请写抵扣的 payout id 与净额。",
    noteRequired: true,
  },
  {
    value: "MANUAL",
    label: "线下追回",
    hint: "通过私下沟通 / 财务流程追回；备注请写跟进负责人与达成方式。",
    noteRequired: true,
  },
  {
    value: "WAIVED",
    label: "平台豁免",
    hint: "金额过小 / 合作关系 / 风控决策 等理由放弃追讨；备注可选。",
    noteRequired: false,
  },
];

export interface ResolveClawbackDialogProps {
  clawbackId: string;
  orderNo: string;
  sellerUsername: string;
  amountCents: number;
  currency: string;
}

export function ResolveClawbackDialog(props: ResolveClawbackDialogProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-tag-amber-fg/30 bg-tag-amber-bg/10 px-2 py-1 text-[11px] text-tag-amber-fg hover:bg-tag-amber-bg/20"
      >
        处理
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <ResolveForm {...props} onClose={() => setOpen(false)} />
      </Dialog>
    </>
  );
}

function ResolveForm({
  clawbackId,
  orderNo,
  sellerUsername,
  amountCents,
  currency,
  onClose,
}: ResolveClawbackDialogProps & { onClose: () => void }) {
  const router = useRouter();
  const [toStatus, setToStatus] = useState<ResolveTo>("DEDUCTED");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const current = OPTIONS.find((o) => o.value === toStatus)!;

  async function submit() {
    setErrMsg(null);
    if (current.noteRequired && !note.trim()) {
      setErrMsg("当前状态必须填写备注");
      return;
    }
    setSubmitting(true);
    try {
      const resp = await fetch(`/api/admin/clawbacks/${clawbackId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toStatus,
          note: note.trim() || undefined,
        }),
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
    <DialogContent ariaLabelledBy="resolve-clawback-dialog-title">
      <DialogHeader>
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Stage 16.4 · 追讨
        </div>
        <DialogTitle id="resolve-clawback-dialog-title">
          标记追讨结果
        </DialogTitle>
        <p className="text-xs text-muted-foreground">
          订单 <span className="font-mono">{orderNo}</span> · 卖家 @{sellerUsername}
        </p>
      </DialogHeader>

      <DialogBody>
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">应追金额</span>
              <MoneyText
                value={amountCents}
                currency={currency === "CNY" ? "¥" : currency + " "}
                tone="negative"
                className="font-semibold"
              />
            </div>
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-[11px] uppercase tracking-wide text-muted-foreground">
              处理方式
            </legend>
            {OPTIONS.map((o) => (
              <label
                key={o.value}
                className={`flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-2 text-xs transition-colors ${
                  toStatus === o.value
                    ? "border-primary/60 bg-primary/10"
                    : "border-border hover:bg-muted/60"
                }`}
              >
                <input
                  type="radio"
                  name="resolve-status"
                  value={o.value}
                  checked={toStatus === o.value}
                  onChange={() => setToStatus(o.value)}
                  className="mt-0.5"
                />
                <span className="space-y-0.5">
                  <span className="block font-medium">{o.label}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {o.hint}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>

          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              备注{current.noteRequired ? "（必填）" : "（可选）"}
            </span>
            <textarea
              data-autofocus
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder={
                toStatus === "DEDUCTED"
                  ? "例：抵扣 payout_xxx，净额 ¥X.XX"
                  : toStatus === "MANUAL"
                    ? "例：卖家承诺 6/20 前转账 ¥X.XX，由财务王跟进"
                    : "可选理由"
              }
              className="block w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary/60"
            />
          </label>

          {errMsg && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
              {errMsg}
            </div>
          )}
        </div>
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
          className="rounded-full border border-tag-amber-fg/40 bg-tag-amber-bg/15 px-3 py-1.5 text-xs font-medium text-tag-amber-fg hover:bg-tag-amber-bg/25 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "处理中…" : "确认"}
        </button>
      </DialogFooter>
    </DialogContent>
  );
}
