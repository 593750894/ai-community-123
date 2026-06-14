"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  PAYOUT_METHODS,
  PAYOUT_METHOD_LABEL,
  type PayoutMethodValue,
} from "@/lib/commerce/schemas";

/**
 * Stage 10.5：卖家绑定 / 更新收款账号。
 *
 * 三字段（method/account/name）同时必填，避免半填状态导致 admin 打款时无法核对。
 * 提交走 PUT /api/me/payout-account；成功后 router.refresh() 让侧栏「未绑定」提示消失。
 */
export interface PayoutAccountFormProps {
  initial: {
    payoutMethod: PayoutMethodValue | null;
    payoutAccount: string | null;
    payoutName: string | null;
  };
}

export function PayoutAccountForm({ initial }: PayoutAccountFormProps) {
  const router = useRouter();
  const [method, setMethod] = useState<PayoutMethodValue>(
    initial.payoutMethod ?? "ALIPAY",
  );
  const [account, setAccount] = useState(initial.payoutAccount ?? "");
  const [name, setName] = useState(initial.payoutName ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrMsg(null);
    setOkMsg(null);
    setSubmitting(true);
    try {
      const resp = await fetch("/api/me/payout-account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payoutMethod: method,
          payoutAccount: account.trim(),
          payoutName: name.trim(),
        }),
      });
      const json = (await resp.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
        error?: { message?: string };
      };
      if (!resp.ok || !json.success) {
        setErrMsg(json.error?.message ?? `更新失败（HTTP ${resp.status}）`);
        return;
      }
      setOkMsg(json.message ?? "已更新");
      router.refresh();
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "网络异常，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-xl border border-border bg-card/40 p-4"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block space-y-1">
          <span className="label-section-strong">
            收款渠道
          </span>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as PayoutMethodValue)}
            className="block h-9 w-full rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-primary/60"
          >
            {PAYOUT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYOUT_METHOD_LABEL[m]}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="label-section-strong">
            收款账号
          </span>
          <input
            type="text"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            maxLength={64}
            required
            placeholder={
              method === "ALIPAY"
                ? "支付宝账号 / 手机号"
                : method === "WECHAT_PAY"
                ? "微信号 / 收款绑定手机号"
                : "银行卡号"
            }
            className="block h-9 w-full rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-primary/60"
          />
        </label>
        <label className="block space-y-1">
          <span className="label-section-strong">
            收款人姓名
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={64}
            required
            placeholder="与账号实名一致"
            className="block h-9 w-full rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-primary/60"
          />
        </label>
      </div>

      <p className="text-[11px] text-muted-foreground">
        提示：账号信息仅用于平台线下打款核对；admin 操作打款时会快照保存当前账号。
      </p>

      {errMsg && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
          {errMsg}
        </div>
      )}
      {okMsg && (
        <div className="rounded-md border border-tag-emerald-fg/30 bg-tag-emerald-bg/10 px-2 py-1.5 text-[11px] text-tag-emerald-fg">
          {okMsg}
        </div>
      )}

      <div className="flex items-center justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "保存中…" : "保存账号"}
        </button>
      </div>
    </form>
  );
}
