"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import {
  AlertTriangle,
  Check,
  Clock,
  Coins,
  ExternalLink,
  Loader2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/ui/money-text";
import { simulateMockPaymentAction } from "@/lib/commerce/checkout-actions";
import {
  ORDER_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  type OrderStatusValue,
  type PaymentMethodValue,
} from "@/lib/commerce/schemas";

export interface CheckoutOrderView {
  orderNo: string;
  type: string;
  status: string;
  amountCents: number;
  currency: string;
  paymentMethod: string | null;
  paymentUrl: string | null;
  expiresAt: string | null;
  paidAt: string | null;
  createdAt: string;
  plan: {
    slug: string;
    name: string;
    cycle: string;
  } | null;
  workflowItem: {
    id: string;
    title: string;
    coverUrl: string | null;
    /**
     * Stage 16.5：是否可以触发下载（卖家已上传文件 + 订单 PAID）。
     * 真实 URL 不再透传到客户端 — 点击下载按钮时 POST /api/orders/.../download-url 拿短期签名 URL。
     */
    downloadAvailable: boolean;
    seller: { id: string; username: string; name: string };
  } | null;
}

interface Props {
  order: CheckoutOrderView;
  /** URL query 中的 provider (=mock 时显示模拟支付按钮)。 */
  provider: string | null;
  /** 服务端 mock 是否启用；客户端不能仅凭 URL 显示模拟按钮。 */
  mockEnabled: boolean;
}

const POLL_INTERVAL_MS = 3_000;

export function CheckoutPanel({ order: initial, provider, mockEnabled }: Props) {
  const router = useRouter();
  const [order, setOrder] = useState<CheckoutOrderView>(initial);
  const [pendingSimulate, startSimulate] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const refreshing = useRef(false);

  useEffect(() => {
    if (order.status !== "PENDING") return;
    const id = window.setInterval(async () => {
      if (refreshing.current) return;
      refreshing.current = true;
      try {
        const resp = await fetch(`/api/orders/${order.orderNo}`, {
          cache: "no-store",
        });
        if (!resp.ok) return;
        const json = await resp.json();
        if (json?.success && json.data) {
          setOrder((prev) => ({
            ...prev,
            status: json.data.status,
            paidAt: json.data.paidAt ?? prev.paidAt,
          }));
        }
      } catch {
        // 网络问题忽略，下一轮再试
      } finally {
        refreshing.current = false;
      }
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [order.status, order.orderNo]);

  useEffect(() => {
    if (order.status === "PAID") {
      router.refresh();
    }
  }, [order.status, router]);

  const isMock = mockEnabled && provider === "mock";
  const statusLabel =
    ORDER_STATUS_LABEL[order.status as OrderStatusValue] ?? order.status;
  const methodLabel = order.paymentMethod
    ? (PAYMENT_METHOD_LABEL[order.paymentMethod as PaymentMethodValue] ??
      order.paymentMethod)
    : "—";

  return (
    <div className="grid gap-6 px-4 py-6 sm:px-8 sm:py-8 lg:grid-cols-[1fr_360px]">
      {/* 左：订单概要 */}
      <section className="surface-card space-y-5 p-6">
        <header className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">订单详情</h2>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {order.orderNo}
            </p>
          </div>
          <StatusBadge status={order.status} />
        </header>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
          <Field label="订单类型">{labelForType(order.type)}</Field>
          <Field label="支付方式">{methodLabel}</Field>
          <Field label="状态">{statusLabel}</Field>
          <Field label="下单时间">{fmtTime(order.createdAt)}</Field>
          {order.paidAt && (
            <Field label="付款时间">{fmtTime(order.paidAt)}</Field>
          )}
          {order.status === "PENDING" && order.expiresAt && (
            <Field label="剩余时间">
              <Countdown deadline={order.expiresAt} />
            </Field>
          )}
        </dl>

        {/* 商品 / 计划信息 */}
        {order.plan && (
          <div className="surface-card border border-border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">{order.plan.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  按 {labelForCycle(order.plan.cycle)} 周期开通
                </p>
              </div>
              <Coins className="size-4 text-muted-foreground" />
            </div>
          </div>
        )}

        {order.workflowItem && (
          <Link
            href={`/marketplace/${order.workflowItem.id}`}
            className="surface-card flex items-center gap-3 border border-border p-3 hover:border-primary/40"
          >
            <div className="relative aspect-video w-24 flex-none overflow-hidden rounded-md bg-muted/40">
              {order.workflowItem.coverUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={order.workflowItem.coverUrl}
                  alt={order.workflowItem.title}
                  className="absolute inset-0 size-full object-cover"
                />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {order.workflowItem.title}
              </p>
              <p className="text-[11px] text-muted-foreground">
                卖家 @{order.workflowItem.seller.username}
              </p>
            </div>
          </Link>
        )}
      </section>

      {/* 右：支付动作 */}
      <aside className="space-y-4">
        <div className="surface-card sticky top-4 space-y-4 p-6">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">应付金额</p>
            <MoneyText
              value={order.amountCents}
              currency={order.currency === "CNY" ? "¥" : order.currency + " "}
              className="block text-3xl font-bold text-primary"
            />
          </div>

          {order.status === "PENDING" && (
            <>
              {order.paymentUrl ? (
                isWechatCodeUrl(order.paymentUrl) ? (
                  <WechatScanPanel codeUrl={order.paymentUrl} />
                ) : (
                  <Button
                    className="w-full"
                    size="lg"
                    nativeButton={false}
                    render={
                      <a
                        href={order.paymentUrl}
                        target={isMock ? "_self" : "_blank"}
                        rel="noopener noreferrer"
                      />
                    }
                  >
                    <ExternalLink className="size-4" />
                    打开{methodLabel}付款
                  </Button>
                )
              ) : (
                <Button className="w-full" size="lg" disabled aria-disabled>
                  支付链接生成中…
                </Button>
              )}

              {isMock && (
                <form
                  action={(formData) => {
                    setErrorMsg(null);
                    startSimulate(async () => {
                      try {
                        await simulateMockPaymentAction(formData);
                      } catch (err) {
                        setErrorMsg(
                          err instanceof Error
                            ? err.message
                            : "模拟支付失败，请稍后再试",
                        );
                      }
                    });
                  }}
                  className="space-y-2"
                >
                  <input type="hidden" name="orderNo" value={order.orderNo} />
                  <Button
                    type="submit"
                    variant="outline"
                    className="w-full"
                    disabled={pendingSimulate}
                  >
                    {pendingSimulate ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        正在模拟支付…
                      </>
                    ) : (
                      <>
                        <Check className="size-3.5" />
                        我已完成支付（开发模拟）
                      </>
                    )}
                  </Button>
                  <p className="text-[11px] text-muted-foreground/70">
                    Stage 10.2 未接通真实支付。Stage 10.3
                    上线后此处会跳到微信扫码 / 支付宝网页支付。
                  </p>
                </form>
              )}

              {errorMsg && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {errorMsg}
                </div>
              )}
            </>
          )}

          {order.status === "PAID" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-md border border-tag-emerald-fg/30 bg-tag-emerald-bg/10 px-3 py-2 text-xs text-tag-emerald-fg">
                <Check className="size-3.5" />
                支付成功，谢谢支持！
              </div>
              {order.plan && (
                <Button
                  className="w-full"
                  nativeButton={false}
                  render={<Link href="/me" />}
                >
                  前往个人中心
                </Button>
              )}
              {order.workflowItem?.downloadAvailable && (
                <SignedDownloadButton orderNo={order.orderNo} />
              )}
              {order.workflowItem && !order.workflowItem.downloadAvailable && (
                <p className="text-[11px] text-muted-foreground">
                  卖家尚未提供下载链接，请稍后再来查看。
                </p>
              )}
            </div>
          )}

          {order.status === "CANCELED" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <AlertTriangle className="size-3.5" />
                订单已超时取消
              </div>
              <Button
                className="w-full"
                variant="outline"
                nativeButton={false}
                render={
                  <Link
                    href={
                      order.workflowItem
                        ? `/marketplace/${order.workflowItem.id}`
                        : order.plan
                          ? "/pricing"
                          : "/"
                    }
                  />
                }
              >
                重新下单
              </Button>
            </div>
          )}

          {order.status === "FAILED" && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="size-3.5" />
              支付失败，请重新下单
            </div>
          )}

          {order.status === "REFUNDED" && (
            <div className="flex items-center gap-2 rounded-md border border-tag-amber-fg/30 bg-tag-amber-bg/10 px-3 py-2 text-xs text-tag-amber-fg">
              <AlertTriangle className="size-3.5" />
              订单已退款
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

/**
 * weixin:// 协议的 code_url 浏览器无法直接打开（只有微信 app 能解析），
 * 必须把它编码成二维码让用户用微信扫一扫扫码完成支付。
 *
 * Stage 10.3 暂时把 URL 文本 + 提示渲染出来，并提供「复制链接」按钮；
 * Stage 10.4 接 qrcode-svg / 内联 QR 渲染器后这里直接画二维码即可。
 */
function isWechatCodeUrl(url: string): boolean {
  return url.startsWith("weixin://");
}

function WechatScanPanel({ codeUrl }: { codeUrl: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(codeUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="space-y-3 rounded-md border border-tag-emerald-fg/30 bg-tag-emerald-bg/5 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-tag-emerald-fg">
        <ExternalLink className="size-4" />
        请使用微信扫一扫支付
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        浏览器无法直接唤起微信付款；请把下方链接编码为二维码后用「微信 · 扫一扫」扫描，或在微信
        PC 端粘贴链接打开。
      </p>
      <code className="block break-all rounded bg-background/40 p-2 text-[11px] text-foreground">
        {codeUrl}
      </code>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        onClick={copy}
      >
        {copied ? "已复制" : "复制支付链接"}
      </Button>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-0.5">
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
        {label}
      </dt>
      <dd className="text-foreground">{children}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label =
    ORDER_STATUS_LABEL[status as OrderStatusValue] ?? status;
  const variant: "primary" | "outline" | "destructive" =
    status === "PAID"
      ? "primary"
      : status === "PENDING"
        ? "outline"
        : "destructive";
  return <Badge variant={variant}>{label}</Badge>;
}

function subscribeToClock(callback: () => void) {
  const id = window.setInterval(callback, 1000);
  return () => window.clearInterval(id);
}

function Countdown({ deadline }: { deadline: string }) {
  const target = useMemo(() => new Date(deadline).getTime(), [deadline]);
  // 用 useSyncExternalStore 而非 useEffect+setState：避免 set-state-in-effect lint，
  // 且 server snapshot 返回 null 防止 SSR hydration mismatch。
  const now = useSyncExternalStore<number | null>(
    subscribeToClock,
    () => Date.now(),
    () => null,
  );
  if (now === null) return <span className="tabular-nums">—:—</span>;
  const remain = Math.max(0, target - now);
  const min = Math.floor(remain / 60000);
  const sec = Math.floor((remain % 60000) / 1000);
  if (remain <= 0) {
    return (
      <span className="text-destructive">
        <Clock className="mr-1 inline-block size-3" />
        已超时
      </span>
    );
  }
  return (
    <span className="tabular-nums">
      <Clock className="mr-1 inline-block size-3" />
      {String(min).padStart(2, "0")}:{String(sec).padStart(2, "0")}
    </span>
  );
}

function fmtTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("zh-CN", { hour12: false });
  } catch {
    return iso;
  }
}

function labelForType(t: string): string {
  switch (t) {
    case "MEMBERSHIP":
      return "会员订阅";
    case "WORKFLOW_PURCHASE":
      return "工作流购买";
    case "COLLABORATION_DEPOSIT":
      return "合作定金";
    default:
      return t;
  }
}

function labelForCycle(c: string): string {
  switch (c) {
    case "MONTHLY":
      return "月";
    case "QUARTERLY":
      return "季";
    case "ANNUAL":
      return "年";
    case "LIFETIME":
      return "买断";
    default:
      return c;
  }
}

/**
 * Stage 16.5：付费下载按钮。点击 → POST /api/orders/{orderNo}/download-url 拿短期签名 URL → 当前窗口跳转。
 *
 * 不在挂载时预签发：避免页面打开就在审计 / 限流上「白白消耗」一次 mint。
 * 出错时把错误信息以小字呈现，不打断 UI。
 */
function SignedDownloadButton({ orderNo }: { orderNo: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-1.5">
      <Button
        type="button"
        className="w-full"
        disabled={pending}
        onClick={async () => {
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
                "签发下载链接失败，请稍后再试";
              setError(msg);
              return;
            }
            // 跳转到签名 URL，浏览器自动跟随服务端 302 到卖家裸 URL。
            window.location.href = body.data.url;
          } catch (err) {
            setError(
              err instanceof Error ? err.message : "网络异常，请稍后再试",
            );
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <ExternalLink className="size-3.5" />
        )}
        下载工作流
      </Button>
      {error && (
        <p className="text-[11px] text-destructive">{error}</p>
      )}
    </div>
  );
}
