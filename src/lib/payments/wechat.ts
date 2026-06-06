import {
  createPrivateKey,
  createPublicKey,
  createSign,
  createVerify,
  createDecipheriv,
  randomBytes,
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
 * Stage 10.3 · 微信支付 v3 provider（Native 扫码 + JSAPI 公众号/小程序）。
 *
 * 设计：
 * - 配置通过环境变量惰性读取；缺任一项 → IS_WECHAT_ENABLED=false，registry 不路由到本 provider。
 * - 请求签名：SHA256-RSA，私钥即 apiclient_key.pem。Authorization 头格式遵循 v3 规范。
 * - 回调验签：用平台公钥（apiclient_platform_cert 解出的 publicKey）校验 Wechatpay-Signature。
 * - 回调 resource：AEAD_AES_256_GCM 解密；associated_data 作为 GCM AAD。
 * - 沙箱：v3 没有官方 sandbox 域名，全部走 https://api.mch.weixin.qq.com。商户号 + 真实小额订单做联调。
 * - 模式选择：
 *   - 默认 Native（生成 code_url 二维码扫码）。
 *   - 当 attach.scene === "JSAPI" 且带 openid（attach.openid）→ JSAPI 走 prepay_id + sdk 配置返回。
 *
 * 安全约束：
 * - 私钥仅在内存，从未写日志。
 * - 验签失败 → verifyWebhook 返 null（API 层翻译为 400）。
 * - 金额对账由 markOrderPaid 兜底（这里只保证回调内容真实，不保证金额匹配业务）。
 */

/**
 * WeChat Pay v3 没有官方 sandbox 域名；联调 / 集成测试时通过 WECHAT_API_BASE
 * 指向本地 fake PSP（见 tests/helpers/fake-psp.ts）；生产环境不要设置。
 *
 * 注意：getter 函数而非顶级 const — 测试场景里端口随机，每次启动新 fake PSP 时
 * WECHAT_API_BASE 都会变，模块级常量会被冻结在首次加载值。
 */
function wechatApiBase(): string {
  return process.env.WECHAT_API_BASE || "https://api.mch.weixin.qq.com";
}
const NATIVE_PATH = "/v3/pay/transactions/native";
const JSAPI_PATH = "/v3/pay/transactions/jsapi";
const QUERY_PATH = "/v3/pay/transactions/out-trade-no";
const REFUND_PATH = "/v3/refund/domestic/refunds";

interface WechatConfig {
  appId: string;
  mchId: string;
  serialNo: string;
  apiV3Key: string;
  privateKey: KeyObject;
  /**
   * serial → 平台公钥。WeChat 平台证书每年轮换一次，新旧并行运行一段时间；
   * 回调 header `Wechatpay-Serial` 指明本次签名所用证书。
   *
   * 配置：
   * - 单证书（推荐 dev / 小商户）：仅 WECHAT_PAY_PLATFORM_PUBLIC_KEY，键名 "default"。
   * - 多证书（生产推荐）：WECHAT_PAY_PLATFORM_PUBLIC_KEYS = JSON {"SERIAL_HEX": "PEM", ...}。
   */
  platformPublicKeys: Map<string, KeyObject>;
}

let cachedConfig: WechatConfig | null | undefined;

function loadConfig(): WechatConfig | null {
  if (cachedConfig !== undefined) return cachedConfig;
  const appId = process.env.WECHAT_PAY_APP_ID;
  const mchId = process.env.WECHAT_PAY_MCH_ID;
  const serialNo = process.env.WECHAT_PAY_SERIAL_NO;
  const apiV3Key = process.env.WECHAT_PAY_API_V3_KEY;
  const privateKeyPem = process.env.WECHAT_PAY_PRIVATE_KEY;
  if (!appId || !mchId || !serialNo || !apiV3Key || !privateKeyPem) {
    cachedConfig = null;
    return null;
  }
  if (Buffer.byteLength(apiV3Key, "utf8") !== 32) {
    throw new Error("WECHAT_PAY_API_V3_KEY must be 32 bytes (utf8).");
  }
  const privateKey = createPrivateKey({
    key: normalizePem(privateKeyPem),
    format: "pem",
  });
  const platformPublicKeys = new Map<string, KeyObject>();
  const mapJson = process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEYS;
  if (mapJson) {
    let parsed: Record<string, string>;
    try {
      parsed = JSON.parse(mapJson) as Record<string, string>;
    } catch {
      throw new Error("WECHAT_PAY_PLATFORM_PUBLIC_KEYS must be JSON {serial: PEM}.");
    }
    for (const [serial, pem] of Object.entries(parsed)) {
      if (typeof pem !== "string" || !pem.trim()) continue;
      platformPublicKeys.set(
        serial,
        createPublicKey({ key: normalizePem(pem), format: "pem" }),
      );
    }
  }
  const legacyPem = process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY;
  if (legacyPem) {
    const legacyKey = createPublicKey({
      key: normalizePem(legacyPem),
      format: "pem",
    });
    if (!platformPublicKeys.has("default")) {
      platformPublicKeys.set("default", legacyKey);
    }
  }
  cachedConfig = {
    appId,
    mchId,
    serialNo,
    apiV3Key,
    privateKey,
    platformPublicKeys,
  };
  return cachedConfig;
}

export const IS_WECHAT_ENABLED = (() => {
  try {
    return loadConfig() !== null;
  } catch {
    return false;
  }
})();

/** Stage 10.3 测试时清理 lazy cache（生产代码勿调用）。 */
export function __resetWechatConfigForTests(): void {
  cachedConfig = undefined;
}

function normalizePem(raw: string): string {
  // 允许 .env 里把换行写成 \n 字符串字面量。
  return raw.includes("BEGIN") ? raw.replace(/\\n/g, "\n") : raw;
}

/**
 * 构造 Authorization 头。timestamp / nonce 由调用者决定（便于测试注入）。
 *
 * 签名串：HTTPMethod\nURL\ntimestamp\nnonce\nbody\n
 *   - URL 是带 querystring 的 path-only（不含 scheme/host）。
 *   - body 为空（GET / DELETE）时是空字符串，仍以 \n 结尾。
 */
export interface BuildAuthInput {
  method: string;
  url: string;
  body: string;
  timestamp?: string;
  nonce?: string;
}

/**
 * 暴露给测试观察的签名串；调用方需把同一 timestamp / nonce 传 buildWechatAuthorization。
 * 不在内部随机化，避免与真实签名串不一致而误导调试。
 */
export function buildWechatSignString(input: Required<BuildAuthInput>): string {
  return `${input.method}\n${input.url}\n${input.timestamp}\n${input.nonce}\n${input.body}\n`;
}

export function buildWechatAuthorization(input: BuildAuthInput): {
  header: string;
  timestamp: string;
  nonce: string;
  signature: string;
} {
  const cfg = requireConfig();
  const timestamp = input.timestamp ?? Math.floor(Date.now() / 1000).toString();
  const nonce = input.nonce ?? randomBytes(16).toString("hex");
  const signString = `${input.method}\n${input.url}\n${timestamp}\n${nonce}\n${input.body}\n`;
  const signature = createSign("RSA-SHA256")
    .update(signString)
    .sign(cfg.privateKey, "base64");
  const header =
    `WECHATPAY2-SHA256-RSA2048 ` +
    `mchid="${cfg.mchId}",` +
    `nonce_str="${nonce}",` +
    `timestamp="${timestamp}",` +
    `serial_no="${cfg.serialNo}",` +
    `signature="${signature}"`;
  return { header, timestamp, nonce, signature };
}

function requireConfig(): WechatConfig {
  const cfg = loadConfig();
  if (!cfg) {
    throw new Error(
      "WeChat Pay is not configured. Set WECHAT_PAY_APP_ID / MCH_ID / SERIAL_NO / API_V3_KEY / PRIVATE_KEY.",
    );
  }
  return cfg;
}

/**
 * 验签：用平台公钥校验响应或回调头。
 *   signString = timestamp\nnonce\nbody\n
 *   signature 为 base64。
 *
 * 关键安全细节：
 * - 平台公钥必须独立配置，不复用商户私钥的派生；缺失 → 返回 false。
 * - timestamp 漂移 ≥ 5min 视为重放 → 拒绝（可由调用方关闭）。
 * - serial 来自 Wechatpay-Serial 头；命中 platformPublicKeys 时优先用对应公钥，
 *   命中失败时回退「轮询所有已知公钥」以处理证书轮换并行窗口。
 */
export function verifyWechatSignature(args: {
  timestamp: string;
  nonce: string;
  body: string;
  signature: string;
  serial?: string;
  skipTimestampCheck?: boolean;
}): boolean {
  const cfg = loadConfig();
  if (!cfg || cfg.platformPublicKeys.size === 0) return false;
  if (!args.skipTimestampCheck) {
    const skew = Math.abs(Math.floor(Date.now() / 1000) - Number(args.timestamp));
    if (!Number.isFinite(skew) || skew > 5 * 60) return false;
  }
  const signString = `${args.timestamp}\n${args.nonce}\n${args.body}\n`;
  const sigBuf = Buffer.from(args.signature, "base64");
  const tryKey = (key: KeyObject): boolean => {
    try {
      return createVerify("RSA-SHA256").update(signString).verify(key, sigBuf);
    } catch {
      return false;
    }
  };
  // 1. 精确匹配 serial。
  if (args.serial) {
    const pinned = cfg.platformPublicKeys.get(args.serial);
    if (pinned && tryKey(pinned)) return true;
  }
  // 2. 回退「default」（legacy 单证书部署）。
  const defaultKey = cfg.platformPublicKeys.get("default");
  if (defaultKey && tryKey(defaultKey)) return true;
  // 3. 兜底：轮换并行窗口期间，遍历所有已知公钥。
  for (const [serial, key] of cfg.platformPublicKeys) {
    if (serial === args.serial || serial === "default") continue;
    if (tryKey(key)) return true;
  }
  return false;
}

/**
 * AEAD_AES_256_GCM 解密回调 resource。
 *   key   = apiV3Key（32 字节 utf8）
 *   nonce = resource.nonce
 *   aad   = resource.associated_data
 *   data  = base64(ciphertext) — 末 16 字节是 GCM auth tag
 */
export function decryptWechatResource(args: {
  ciphertext: string;
  nonce: string;
  associatedData: string;
}): string {
  const cfg = requireConfig();
  const raw = Buffer.from(args.ciphertext, "base64");
  if (raw.length < 17) throw new Error("ciphertext too short");
  const authTag = raw.subarray(raw.length - 16);
  const data = raw.subarray(0, raw.length - 16);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(cfg.apiV3Key, "utf8"),
    Buffer.from(args.nonce, "utf8"),
  );
  decipher.setAuthTag(authTag);
  decipher.setAAD(Buffer.from(args.associatedData, "utf8"));
  const out = Buffer.concat([decipher.update(data), decipher.final()]);
  return out.toString("utf8");
}

async function wechatRequest<T>(args: {
  method: "GET" | "POST";
  path: string;
  body?: unknown;
}): Promise<T> {
  const bodyStr = args.body ? JSON.stringify(args.body) : "";
  const { header } = buildWechatAuthorization({
    method: args.method,
    url: args.path,
    body: bodyStr,
  });
  const res = await fetch(`${wechatApiBase()}${args.path}`, {
    method: args.method,
    headers: {
      Authorization: header,
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "seedland-v/0.1 (+wechatpay-v3)",
    },
    body: args.method === "GET" ? undefined : bodyStr,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `WeChat Pay ${args.method} ${args.path} → ${res.status} ${text}`,
    );
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

function toWechatTimeExpire(d: Date): string {
  // 微信要求 RFC3339 + 时区偏移；UTC 即 +00:00。
  return d.toISOString().replace(/\.\d{3}Z$/, "+00:00");
}

interface NativeCreateResp {
  code_url: string;
}
interface JsapiCreateResp {
  prepay_id: string;
}
interface QueryResp {
  trade_state: string;
  transaction_id?: string;
  success_time?: string;
  amount?: { total?: number; payer_total?: number };
}

export const wechatProvider: PaymentProvider = {
  id: "WECHAT_PAY",

  async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    const cfg = requireConfig();
    const scene = input.attach?.scene === "JSAPI" ? "JSAPI" : "NATIVE";
    const base = {
      appid: cfg.appId,
      mchid: cfg.mchId,
      description: input.subject,
      out_trade_no: input.orderNo,
      notify_url: input.notifyUrl,
      time_expire: toWechatTimeExpire(input.expiresAt),
      amount: {
        total: input.amountCents,
        currency: input.currency || "CNY",
      },
    } as Record<string, unknown>;

    if (scene === "JSAPI") {
      const openid = input.attach?.openid;
      if (typeof openid !== "string" || !openid) {
        throw new Error("JSAPI scene requires attach.openid");
      }
      const resp = await wechatRequest<JsapiCreateResp>({
        method: "POST",
        path: JSAPI_PATH,
        body: { ...base, payer: { openid } },
      });
      // 二次签名：wx.requestPayment / WeixinJSBridge.invoke 所需的 6 字段 payload。
      // 签名串：appId\ntimeStamp\nnonceStr\npackage\n （4 行 + 末尾 \n）。
      // 重要：paySign 不能透传到 URL（会从 referer / 日志泄漏）；前端走 GET /api/orders/{orderNo}/jsapi-invoke 拉取。
      const timeStamp = Math.floor(Date.now() / 1000).toString();
      const nonceStr = randomBytes(16).toString("hex");
      const pkg = `prepay_id=${resp.prepay_id}`;
      const sdkSignString = `${cfg.appId}\n${timeStamp}\n${nonceStr}\n${pkg}\n`;
      const paySign = createSign("RSA-SHA256")
        .update(sdkSignString)
        .sign(cfg.privateKey, "base64");
      return {
        // JSAPI 没有跳转链接；前端拿 jsapiInvoke 调 wx.requestPayment。
        // paymentUrl 指向我们站内 checkout/{orderNo}，由 CheckoutPanel 调用 invoke 接口拉 payload。
        paymentUrl: `${stripQuery(input.returnUrl)}?provider=wechat_pay&scene=jsapi`,
        transactionId: input.orderNo, // 注意：用 orderNo 占位，避免 prepay_id 写库（2h 后过期，无业务唯一价值）。
        raw: resp,
        jsapiInvoke: {
          appId: cfg.appId,
          timeStamp,
          nonceStr,
          package: pkg,
          signType: "RSA",
          paySign,
        },
      };
    }

    const resp = await wechatRequest<NativeCreateResp>({
      method: "POST",
      path: NATIVE_PATH,
      body: base,
    });
    return {
      paymentUrl: resp.code_url,
      transactionId: input.orderNo,
      raw: resp,
    };
  },

  async queryStatus(
    _transactionId: string,
    orderNo: string,
  ): Promise<QueryChargeResult> {
    const cfg = requireConfig();
    const path = `${QUERY_PATH}/${encodeURIComponent(orderNo)}?mchid=${cfg.mchId}`;
    const resp = await wechatRequest<QueryResp>({ method: "GET", path });
    const status = mapWechatTradeState(resp.trade_state);
    return {
      status,
      transactionId: resp.transaction_id,
      paidAt: resp.success_time ? new Date(resp.success_time) : undefined,
      amountCents: resp.amount?.total,
      raw: resp,
    };
  },

  async refund(input: RefundInput): Promise<RefundResult> {
    // Stage 10.4：
    //   - out_refund_no = 调用方传入的 idempotencyKey (= `R{Refund.id}`)，长度 ≤ 64 字节即可
    //   - amount.total = 原订单金额（必须等于下单时的金额），amount.refund = 本次退款金额
    //     部分退款时两者不同；之前 Stage 10.3 临时把 total 设成 refund，微信会拒。
    //   - reason 透传；缺省 "用户申请退款"。
    const resp = await wechatRequest({
      method: "POST",
      path: REFUND_PATH,
      body: {
        out_trade_no: input.orderNo,
        out_refund_no: input.idempotencyKey,
        reason: input.reason ?? "用户申请退款",
        amount: {
          refund: input.amountCents,
          total: input.originalAmountCents,
          currency: "CNY",
        },
      },
    });
    return { ok: true, raw: resp };
  },

  async verifyWebhook(raw: string, headers: Headers): Promise<WebhookEvent | null> {
    const timestamp = headers.get("wechatpay-timestamp") ?? "";
    const nonce = headers.get("wechatpay-nonce") ?? "";
    const signature = headers.get("wechatpay-signature") ?? "";
    const serial = headers.get("wechatpay-serial") ?? undefined;
    if (!timestamp || !nonce || !signature) return null;
    if (!verifyWechatSignature({ timestamp, nonce, body: raw, signature, serial })) {
      return null;
    }
    let body: {
      event_type?: string;
      resource?: {
        ciphertext?: string;
        nonce?: string;
        associated_data?: string;
      };
    };
    try {
      body = JSON.parse(raw);
    } catch {
      return null;
    }
    if (!body.resource?.ciphertext || !body.resource.nonce) return null;
    let plain: string;
    try {
      plain = decryptWechatResource({
        ciphertext: body.resource.ciphertext,
        nonce: body.resource.nonce,
        associatedData: body.resource.associated_data ?? "",
      });
    } catch {
      return null;
    }
    let resource: {
      out_trade_no?: string;
      transaction_id?: string;
      success_time?: string;
      trade_state?: string;
      amount?: { total?: number };
    };
    try {
      resource = JSON.parse(plain);
    } catch {
      return null;
    }
    if (
      !resource.out_trade_no ||
      !resource.transaction_id ||
      typeof resource.amount?.total !== "number" ||
      !resource.success_time
    ) {
      return null;
    }
    const paidAt = new Date(resource.success_time);
    if (Number.isNaN(paidAt.getTime())) return null;
    const type =
      body.event_type === "TRANSACTION.SUCCESS" &&
      resource.trade_state === "SUCCESS"
        ? "ORDER_PAID"
        : body.event_type?.startsWith("REFUND")
          ? "ORDER_REFUNDED"
          : "UNKNOWN";
    return {
      type,
      orderNo: resource.out_trade_no,
      transactionId: resource.transaction_id,
      amountCents: resource.amount.total,
      paidAt,
      raw: resource,
    };
  },
};

function mapWechatTradeState(s: string | undefined) {
  switch (s) {
    case "SUCCESS":
      return "PAID" as const;
    case "REFUND":
    case "CLOSED":
    case "REVOKED":
      return "CANCELED" as const;
    case "PAYERROR":
      return "FAILED" as const;
    case "NOTPAY":
    case "USERPAYING":
    default:
      return "PENDING" as const;
  }
}

function stripQuery(url: string): string {
  const i = url.indexOf("?");
  return i === -1 ? url : url.slice(0, i);
}
