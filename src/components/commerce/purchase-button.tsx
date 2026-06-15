"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Coins, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  PAYMENT_METHOD_DISPLAY,
  SELECTABLE_PAYMENT_METHODS,
  type SelectablePaymentMethod,
} from "@/lib/payments/registry";

/**
 * Stage 16.2：生成一次性幂等键。useMemo 锁定到购买意图维度——
 * 同一组件实例 + 同一商品 = 同一 nonce（双击 / 网络重试 → 同一订单）；
 * 路由跳转 / 不同商品 / 卸载重挂 = 新 nonce（新购买意图）。
 *
 * 字符集 alnum + `-`，长度 22-24，符合 server schema /^[A-Za-z0-9_-]{8,64}$/。
 * 用 crypto.randomUUID 拼时间戳确保即使同毫秒多个实例也不重。
 */
function generateNonce(): string {
  const rnd =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 16)
      : Math.random().toString(36).slice(2, 18).padEnd(16, "0");
  return `n${Date.now().toString(36)}${rnd}`.slice(0, 32);
}

type Payload =
  | { type: "MEMBERSHIP"; planSlug: string }
  | { type: "WORKFLOW_PURCHASE"; workflowItemId: string };

interface Props {
  payload: Payload;
  /** 已登录 → false；匿名 → true，按钮直接跳 login。 */
  unauthenticated?: boolean;
  /** 父级要求禁用（售罄 / 价格 0 / 自购等） */
  disabled?: boolean;
  disabledReason?: string;
  /** CTA 主按钮文案 */
  label?: string;
  /** 主按钮配色（与 Button.variant 同源） */
  variant?: "default" | "outline";
  /** 主按钮尺寸 */
  size?: "default" | "sm" | "lg";
  className?: string;
}

/**
 * 公共购买按钮（pricing / marketplace 详情页共用）。
 * - 匿名 → 跳 /auth/login?next=...
 * - 已登录 → 弹出方式选择（微信 / 支付宝）→ POST /api/orders → 跳 /checkout/{orderNo}
 *
 * Stage 10.2 两个 method 都走 mock；UI 仍呈现真实选项以走通业务流程。
 */
export function PurchaseButton({
  payload,
  unauthenticated,
  disabled,
  disabledReason,
  label = "立即购买",
  variant = "default",
  size = "lg",
  className,
}: Props) {
  const router = useRouter();
  const [method, setMethod] = useState<SelectablePaymentMethod>(
    SELECTABLE_PAYMENT_METHODS[0],
  );
  const [pending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // 锁定到 (type, id)：商品 / 计划变了 → 新 intent → 新 nonce；
  // 同一 intent 重渲染 / 切支付方式 / 失败重试 → 同一 nonce → server 复用同一订单。
  const intentKey =
    payload.type === "MEMBERSHIP"
      ? `m:${payload.planSlug}`
      : `w:${payload.workflowItemId}`;
  const clientNonce = useMemo(
    () => generateNonce(),
    // intentKey 是有意作 cache key 的 dep，body 不需要读它。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [intentKey],
  );

  function onSubmit() {
    if (disabled) return;
    if (unauthenticated) {
      const next =
        typeof window !== "undefined"
          ? encodeURIComponent(window.location.pathname + window.location.search)
          : "/";
      router.push(`/auth/login?next=${next}`);
      return;
    }
    setErrorMsg(null);
    startTransition(async () => {
      try {
        const resp = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            paymentMethod: method,
            clientNonce,
          }),
        });
        if (resp.status === 401) {
          const next =
            typeof window !== "undefined"
              ? encodeURIComponent(
                  window.location.pathname + window.location.search,
                )
              : "/";
          router.push(`/auth/login?next=${next}`);
          return;
        }
        const json = (await resp.json().catch(() => null)) as
          | { success: boolean; data?: { orderNo?: string }; error?: { message?: string } }
          | null;
        if (!resp.ok || !json?.success || !json.data?.orderNo) {
          setErrorMsg(json?.error?.message ?? "下单失败，请稍后再试");
          return;
        }
        router.push(`/checkout/${json.data.orderNo}`);
      } catch {
        setErrorMsg("网络异常，请稍后再试");
      }
    });
  }

  return (
    <div className={className}>
      {!disabled && (
        <fieldset className="mb-3 space-y-2">
          <legend className="text-[11px] text-muted-foreground">
            选择支付方式
          </legend>
          <div className="flex gap-2">
            {SELECTABLE_PAYMENT_METHODS.map((m) => {
              const active = method === m;
              return (
                <label
                  key={m}
                  className={`flex-1 cursor-pointer rounded-md border px-3 py-2 text-center text-xs transition-colors ${
                    active
                      ? "border-primary/60 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-border"
                  }`}
                >
                  <input
                    type="radio"
                    name={`paymentMethod-${payload.type}`}
                    value={m}
                    checked={active}
                    onChange={() => setMethod(m)}
                    className="sr-only"
                  />
                  {PAYMENT_METHOD_DISPLAY[m]}
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      <Button
        type="button"
        onClick={onSubmit}
        disabled={disabled || pending}
        aria-disabled={disabled || pending || undefined}
        variant={variant}
        size={size}
        className="w-full"
        title={disabled ? disabledReason : undefined}
      >
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            正在创建订单…
          </>
        ) : (
          <>
            <Coins className="size-4" />
            {label}
          </>
        )}
      </Button>

      {errorMsg && (
        <p className="mt-2 text-[11px] text-destructive">{errorMsg}</p>
      )}
      {disabled && disabledReason && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {disabledReason}
        </p>
      )}
    </div>
  );
}
