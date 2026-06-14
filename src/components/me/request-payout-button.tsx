"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { formatPrice } from "@/lib/commerce/schemas";
import { MoneyText } from "@/components/ui/money-text";

/**
 * Stage 10.5：卖家「申请提现」按钮。
 *
 * 三态：
 *   - 未绑定收款账号 → 按钮 disabled + 提示
 *   - 有可申请 AVAILABLE 行 → 「申请提现」（active）
 *   - 已经申请、admin 还没打款 → 「撤回提现申请」
 */
export interface RequestPayoutButtonProps {
  hasAccount: boolean;
  availableNetCents: number;
  availableCount: number;
  hasPendingRequest: boolean;
  pendingRequestNetCents: number;
  currency: string;
}

export function RequestPayoutButton({
  hasAccount,
  availableNetCents,
  availableCount,
  hasPendingRequest,
  pendingRequestNetCents,
  currency,
}: RequestPayoutButtonProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const canRequest = hasAccount && availableCount > 0 && !hasPendingRequest;

  async function call(method: "POST" | "DELETE") {
    setErrMsg(null);
    setSubmitting(true);
    try {
      const resp = await fetch("/api/me/payouts/request", { method });
      const json = (await resp.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
        error?: { message?: string };
      };
      if (!resp.ok || !json.success) {
        setErrMsg(json.error?.message ?? `请求失败（HTTP ${resp.status}）`);
        return;
      }
      router.refresh();
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "网络异常，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {hasPendingRequest ? (
          <>
            <span className="inline-flex items-center gap-1 rounded-md border border-tag-amber-fg/30 bg-tag-amber-bg/10 px-2.5 py-1 text-[11px] text-tag-amber-fg">
              已申请 <MoneyText value={pendingRequestNetCents} currency={currency} /> · 等待打款
            </span>
            <button
              type="button"
              onClick={() => call("DELETE")}
              disabled={submitting}
              className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "处理中…" : "撤回申请"}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => call("POST")}
            disabled={!canRequest || submitting}
            className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting
              ? "提交中…"
              : `申请提现（${availableCount} 笔 · ${formatPrice(availableNetCents, currency)}）`}
          </button>
        )}
      </div>

      {!hasAccount && (
        <p className="text-[11px] text-tag-amber-fg">
          请先在下方完善收款账号信息后再申请提现。
        </p>
      )}
      {hasAccount && availableCount === 0 && !hasPendingRequest && (
        <p className="text-[11px] text-muted-foreground">
          当前没有可申请提现的结算单。新订单付款后将进入 7 天冷藏期，结束后自动转入可提现状态。
        </p>
      )}

      {errMsg && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
          {errMsg}
        </div>
      )}
    </div>
  );
}
