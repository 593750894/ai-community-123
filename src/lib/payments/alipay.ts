import {
  createPrivateKey,
  createPublicKey,
  createSign,
  createVerify,
  type KeyObject,
} from "node:crypto";

import type {
  CreateChargeInput,
  CreateChargeResult,
  PaymentProvider,
  QueryChargeResult,
  RefundInput,
  RefundResult,
  WebhookEvent,
} from "./types";

/**
 * Stage 10.3 · 支付宝 provider（PC 网页 alipay.trade.page.pay + 手机网页 alipay.trade.wap.pay）。
 *
 * 签名：RSA2（SHA256withRSA），私钥来自支付宝开放平台「应用私钥」。
 * 验签：用「支付宝公钥」验证响应 / 异步通知。注意区分「应用公钥」（你的）与「支付宝公钥」（他们的，用于验签）。
 *
 * 沙箱：
 *   - 网关：https://openapi.alipaydev.com/gateway.do
 *   - 正式：https://openapi.alipay.com/gateway.do
 *   - ALIPAY_GATEWAY 可强制覆盖（默认按 NODE_ENV 选）。
 *
 * 关键安全：
 * - 异步通知必须用 raw form-urlencoded body 提取键值，剔除 sign + sign_type 后排序再验签。
 * - 任何字段为 null/empty 都需要参与排序，但不参与签名串拼接（与 sign/sign_type 规则一致）。
 */

interface AlipayConfig {
  appId: string;
  appPrivateKey: KeyObject;
  alipayPublicKey: KeyObject;
  gateway: string;
  signType: "RSA2";
}

let cachedConfig: AlipayConfig | null | undefined;

function loadConfig(): AlipayConfig | null {
  if (cachedConfig !== undefined) return cachedConfig;
  const appId = process.env.ALIPAY_APP_ID;
  const appPrivateKeyPem = process.env.ALIPAY_APP_PRIVATE_KEY;
  const alipayPublicKeyPem = process.env.ALIPAY_PUBLIC_KEY;
  if (!appId || !appPrivateKeyPem || !alipayPublicKeyPem) {
    cachedConfig = null;
    return null;
  }
  const appPrivateKey = createPrivateKey({
    key: ensurePem(appPrivateKeyPem, "PRIVATE KEY"),
    format: "pem",
  });
  const alipayPublicKey = createPublicKey({
    key: ensurePem(alipayPublicKeyPem, "PUBLIC KEY"),
    format: "pem",
  });
  const gateway =
    process.env.ALIPAY_GATEWAY ||
    (process.env.NODE_ENV === "production"
      ? "https://openapi.alipay.com/gateway.do"
      : "https://openapi.alipaydev.com/gateway.do");
  cachedConfig = {
    appId,
    appPrivateKey,
    alipayPublicKey,
    gateway,
    signType: "RSA2",
  };
  return cachedConfig;
}

export const IS_ALIPAY_ENABLED = (() => {
  try {
    return loadConfig() !== null;
  } catch {
    return false;
  }
})();

/** Stage 10.3 测试时清理 lazy cache。 */
export function __resetAlipayConfigForTests(): void {
  cachedConfig = undefined;
}

/**
 * 支付宝接受裸 base64（不带 PEM header）。这里宽松处理：有 BEGIN/END 头就原样，否则补上。
 */
function ensurePem(raw: string, label: "PRIVATE KEY" | "PUBLIC KEY"): string {
  const t = raw.replace(/\\n/g, "\n").trim();
  if (t.includes("BEGIN")) return t;
  const wrapped = t.match(/.{1,64}/g)?.join("\n") ?? t;
  return `-----BEGIN ${label}-----\n${wrapped}\n-----END ${label}-----\n`;
}

function requireConfig(): AlipayConfig {
  const cfg = loadConfig();
  if (!cfg) {
    throw new Error(
      "Alipay is not configured. Set ALIPAY_APP_ID / ALIPAY_APP_PRIVATE_KEY / ALIPAY_PUBLIC_KEY.",
    );
  }
  return cfg;
}

/**
 * 拼接规范字符串：剔除 sign + sign_type + 空值，按 key 升序，`a=v&b=v` 形式。
 *
 * 异步通知场景下，value 来自 application/x-www-form-urlencoded 解码后的原文。
 * 注意 Node 的 URLSearchParams 已经按 utf-8 解码，所以直接拿值即可（支付宝官方文档版本对此一致）。
 */
export function buildAlipaySignString(params: Record<string, string>): string {
  const keys = Object.keys(params)
    .filter((k) => k !== "sign" && k !== "sign_type")
    .filter((k) => params[k] != null && params[k] !== "")
    .sort();
  return keys.map((k) => `${k}=${params[k]}`).join("&");
}

export function signAlipayParams(params: Record<string, string>): string {
  const cfg = requireConfig();
  const signString = buildAlipaySignString(params);
  return createSign("RSA-SHA256")
    .update(signString, "utf8")
    .sign(cfg.appPrivateKey, "base64");
}

export function verifyAlipayParams(params: Record<string, string>): boolean {
  const cfg = loadConfig();
  if (!cfg) return false;
  const signature = params.sign;
  if (!signature) return false;
  const signString = buildAlipaySignString(params);
  try {
    return createVerify("RSA-SHA256")
      .update(signString, "utf8")
      .verify(cfg.alipayPublicKey, Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
}

/**
 * 拼接 gateway URL：业务参数 biz_content 单独 JSON 化后参与签名。
 */
function buildGatewayUrl(args: {
  method: string;
  bizContent: Record<string, unknown>;
  notifyUrl: string;
  returnUrl?: string;
}): string {
  const cfg = requireConfig();
  const params: Record<string, string> = {
    app_id: cfg.appId,
    method: args.method,
    charset: "utf-8",
    sign_type: cfg.signType,
    timestamp: toAlipayLocalTime(new Date()),
    version: "1.0",
    biz_content: JSON.stringify(args.bizContent),
    notify_url: args.notifyUrl,
  };
  if (args.returnUrl) params.return_url = args.returnUrl;
  const signature = signAlipayParams(params);
  params.sign = signature;
  const qs = Object.entries(params)
    .map(
      ([k, v]) =>
        `${encodeURIComponent(k)}=${encodeURIComponent(v ?? "")}`,
    )
    .join("&");
  return `${cfg.gateway}?${qs}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * 支付宝公共参数 `timestamp` 与 biz_content.time_expire 的格式 `yyyy-MM-dd HH:mm:ss`
 * 均按「商户所在时区」解释；境内商户 = Asia/Shanghai (+08:00)。
 *
 * 错用 UTC 会让 time_expire 比下单时间「早 8 小时」，Alipay 把它当作已经过期
 * 直接返回 ACQ.TRADE_HAS_EXPIRED。
 *
 * Asia/Shanghai 自 1991 年起无 DST，固定 +08:00，所以加 8h 后读 UTC 字段即可。
 * 想跨境支持时可走 ALIPAY_MERCHANT_TZ_OFFSET_MIN 覆盖（默认 480 = 8h）。
 */
function toAlipayLocalTime(d: Date): string {
  const offsetMin = Number(process.env.ALIPAY_MERCHANT_TZ_OFFSET_MIN ?? 480);
  const shifted = new Date(d.getTime() + offsetMin * 60_000);
  return (
    `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())} ` +
    `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}`
  );
}

export const alipayProvider: PaymentProvider = {
  id: "ALIPAY",

  async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    requireConfig();
    const scene = input.attach?.scene === "WAP" ? "WAP" : "PAGE";
    const totalYuan = (input.amountCents / 100).toFixed(2);
    const biz: Record<string, unknown> = {
      out_trade_no: input.orderNo,
      total_amount: totalYuan,
      subject: input.subject,
      body: input.description,
      time_expire: toAlipayLocalTime(input.expiresAt),
      product_code: scene === "WAP" ? "QUICK_WAP_WAY" : "FAST_INSTANT_TRADE_PAY",
    };
    const method =
      scene === "WAP" ? "alipay.trade.wap.pay" : "alipay.trade.page.pay";
    const url = buildGatewayUrl({
      method,
      bizContent: biz,
      notifyUrl: input.notifyUrl,
      returnUrl: input.returnUrl,
    });
    return {
      paymentUrl: url,
      transactionId: input.orderNo, // 支付前没有 trade_no；落 out_trade_no 占位，回调时替换。
      raw: { method, scene },
    };
  },

  async queryStatus(
    _transactionId: string,
    orderNo: string,
  ): Promise<QueryChargeResult> {
    const cfg = requireConfig();
    const params: Record<string, string> = {
      app_id: cfg.appId,
      method: "alipay.trade.query",
      charset: "utf-8",
      sign_type: cfg.signType,
      timestamp: toAlipayLocalTime(new Date()),
      version: "1.0",
      biz_content: JSON.stringify({ out_trade_no: orderNo }),
    };
    params.sign = signAlipayParams(params);
    const body = new URLSearchParams(params).toString();
    const res = await fetch(cfg.gateway, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const json = (await res.json()) as {
      alipay_trade_query_response?: {
        trade_status?: string;
        trade_no?: string;
        send_pay_date?: string;
        total_amount?: string;
      };
    };
    const r = json.alipay_trade_query_response;
    return {
      status: mapAlipayTradeStatus(r?.trade_status),
      transactionId: r?.trade_no,
      paidAt: r?.send_pay_date ? new Date(r.send_pay_date) : undefined,
      amountCents: r?.total_amount
        ? Math.round(Number(r.total_amount) * 100)
        : undefined,
      raw: json,
    };
  },

  async refund(input: RefundInput): Promise<RefundResult> {
    const cfg = requireConfig();
    // Stage 10.4：out_request_no = 调用方传入的 idempotencyKey (= `R{Refund.id}`)。
    // 支付宝同 out_request_no 重发会返回原结果，跨次部分退款用新 Refund 行的 id 即可。
    // 不需要 originalAmountCents — alipay refund 只读 refund_amount 与原订单做对账，没有 total 字段。
    const params: Record<string, string> = {
      app_id: cfg.appId,
      method: "alipay.trade.refund",
      charset: "utf-8",
      sign_type: cfg.signType,
      timestamp: toAlipayLocalTime(new Date()),
      version: "1.0",
      biz_content: JSON.stringify({
        out_trade_no: input.orderNo,
        out_request_no: input.idempotencyKey,
        refund_amount: (input.amountCents / 100).toFixed(2),
        refund_reason: input.reason ?? "用户申请退款",
      }),
    };
    params.sign = signAlipayParams(params);
    const body = new URLSearchParams(params).toString();
    const res = await fetch(cfg.gateway, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const json = (await res.json()) as {
      alipay_trade_refund_response?: { code?: string; msg?: string };
    };
    const r = json.alipay_trade_refund_response;
    const ok = r?.code === "10000";
    return { ok, message: r?.msg, raw: json };
  },

  async verifyWebhook(raw: string): Promise<WebhookEvent | null> {
    // 支付宝异步通知是 application/x-www-form-urlencoded；header 不参与签名。
    const params = parseFormUrlencoded(raw);
    if (!verifyAlipayParams(params)) return null;
    // Defense-in-depth：Alipay 公钥跨所有商户共用，仅靠签名无法证明回调属于本应用。
    // 校验 app_id 必须与配置一致，避免跨商户 / 跨应用 replay。
    const cfg = loadConfig();
    if (!cfg) return null;
    if (params.app_id !== cfg.appId) return null;
    const tradeStatus = params.trade_status;
    const orderNo = params.out_trade_no;
    const tradeNo = params.trade_no;
    const totalAmount = params.total_amount;
    const gmtPayment = params.gmt_payment || params.notify_time;
    if (!orderNo || !tradeNo || !totalAmount || !gmtPayment) return null;
    const paidAt = new Date(gmtPayment.replace(" ", "T") + "+08:00");
    if (Number.isNaN(paidAt.getTime())) return null;
    const amountCents = Math.round(Number(totalAmount) * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) return null;
    const type =
      tradeStatus === "TRADE_SUCCESS" || tradeStatus === "TRADE_FINISHED"
        ? "ORDER_PAID"
        : tradeStatus === "TRADE_CLOSED" && Number(params.refund_fee) > 0
          ? "ORDER_REFUNDED"
          : "UNKNOWN";
    return {
      type,
      orderNo,
      transactionId: tradeNo,
      amountCents,
      paidAt,
      raw: params,
    };
  },
};

function parseFormUrlencoded(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  const params = new URLSearchParams(body);
  params.forEach((v, k) => {
    out[k] = v;
  });
  return out;
}

function mapAlipayTradeStatus(s: string | undefined) {
  switch (s) {
    case "TRADE_SUCCESS":
    case "TRADE_FINISHED":
      return "PAID" as const;
    case "TRADE_CLOSED":
      return "CANCELED" as const;
    case "WAIT_BUYER_PAY":
    default:
      return "PENDING" as const;
  }
}
