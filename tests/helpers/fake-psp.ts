import {
  createCipheriv,
  createPrivateKey,
  createPublicKey,
  createSign,
  createVerify,
  generateKeyPairSync,
  randomBytes,
  type KeyObject,
} from "node:crypto";
import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import { AddressInfo } from "node:net";

/**
 * Stage 10.3 联调 · 本地 fake PSP（pay-service provider）。
 *
 * 作用：替代真实微信 / 支付宝沙箱，用于：
 *  1. 接收商户（我们）的下单 / 查询 / 退款请求，并校验请求签名（暴露我们的签名 bug）。
 *  2. 提供 simulatePaid(orderNo) 入口，让测试向我们的 webhook 路由打回一个 *用平台私钥真实签名* 的回调。
 *
 * 设计要点：
 *  - 用 Node http 包零依赖跑。listen(0) 拿随机端口。
 *  - 微信：现场生成 2 套 RSA — 商户 + 平台；商户私钥 / 平台公钥灌进 provider env，
 *    平台私钥留给 fake PSP 给 webhook 签名，商户公钥留给 fake PSP 给 createCharge 验签。
 *  - 支付宝：现场生成 2 套 RSA — 应用 + 支付宝；应用公钥留给 fake PSP 验证 page.pay 请求；
 *    支付宝私钥用于给异步通知签名。
 *
 * 不依赖 expect 库，调用方写 assert 即可。
 */

export interface FakeWechatHandles {
  apiV3Key: string;
  merchantPrivateKeyPem: string;
  merchantPublicKey: KeyObject;
  platformPrivateKey: KeyObject;
  platformPublicKeyPem: string;
  mchId: string;
  appId: string;
  serialNo: string;
}

export interface FakeAlipayHandles {
  appId: string;
  appPrivateKeyPem: string;
  appPublicKey: KeyObject;
  alipayPrivateKey: KeyObject;
  alipayPublicKeyPem: string;
}

export interface FakePspState {
  /** 已收到的下单请求计数（按 orderNo）。 */
  charges: Map<string, { provider: "wechat" | "alipay"; amountCents: number; subject: string }>;
  /** 收到过的回调签名失败次数，便于断言。 */
  signatureRejects: number;
  /** 收到的下单 raw body，便于断言。 */
  rawRequests: Array<{ provider: "wechat" | "alipay"; path: string; body: string }>;
}

export interface FakePspServer {
  url: string;
  port: number;
  wechat: FakeWechatHandles;
  alipay: FakeAlipayHandles;
  state: FakePspState;
  /**
   * 把指定订单标记为已支付：对 webhook 接收方（被测系统）发起回调。
   * provider = "wechat" → 走 AEAD_AES_256_GCM + RSA-SHA256 平台签名。
   * provider = "alipay" → 走 form-urlencoded + RSA2 签名。
   *
   * @returns webhook response status / body
   */
  simulatePaid(args: {
    provider: "wechat" | "alipay";
    targetWebhookBase: string; // 被测系统 base，如 http://localhost:3000
    orderNo: string;
    amountCents: number;
    transactionId?: string;
  }): Promise<{ status: number; body: string }>;
  stop(): Promise<void>;
}

function makeRsa(): { privatePem: string; publicPem: string; privateKey: KeyObject; publicKey: KeyObject } {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return {
    privatePem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    publicPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
    privateKey,
    publicKey,
  };
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c as Buffer));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  const s = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(s),
  });
  res.end(s);
}

function sendText(res: ServerResponse, status: number, body: string, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

/**
 * 解析 WeChat Pay v3 Authorization 头：
 *   WECHATPAY2-SHA256-RSA2048 mchid="...",nonce_str="...",timestamp="...",serial_no="...",signature="..."
 */
function parseWechatAuth(header: string): Record<string, string> | null {
  const m = header.match(/^WECHATPAY2-SHA256-RSA2048\s+(.+)$/);
  if (!m) return null;
  const out: Record<string, string> = {};
  for (const part of m[1].split(",")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim();
    let v = part.slice(eq + 1).trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    out[k] = v;
  }
  return out;
}

function aliBuildSignString(params: Record<string, string>): string {
  return Object.keys(params)
    .filter((k) => k !== "sign" && k !== "sign_type")
    .filter((k) => params[k] != null && params[k] !== "")
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
}

export async function startFakePsp(): Promise<FakePspServer> {
  const merchant = makeRsa();
  const platform = makeRsa();
  const wechat: FakeWechatHandles = {
    apiV3Key: "0123456789abcdef0123456789abcdef",
    merchantPrivateKeyPem: merchant.privatePem,
    merchantPublicKey: merchant.publicKey,
    platformPrivateKey: platform.privateKey,
    platformPublicKeyPem: platform.publicPem,
    mchId: "1234567890",
    appId: "wxFakeAppId",
    serialNo: "TESTSERIAL01",
  };
  const app = makeRsa();
  const ali = makeRsa();
  const alipay: FakeAlipayHandles = {
    appId: "2026FAKEALIAPP",
    appPrivateKeyPem: app.privatePem,
    appPublicKey: app.publicKey,
    alipayPrivateKey: ali.privateKey,
    alipayPublicKeyPem: ali.publicPem,
  };
  const state: FakePspState = {
    charges: new Map(),
    signatureRejects: 0,
    rawRequests: [],
  };

  const server: Server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://x");
      const method = req.method ?? "GET";
      const path = url.pathname;
      const body = method === "GET" ? "" : await readBody(req);

      // ── WeChat Pay v3 ──────────────────────────────────────────────
      if (path.startsWith("/v3/")) {
        state.rawRequests.push({ provider: "wechat", path: url.pathname + url.search, body });
        // 1) 验证 Authorization 头：用商户公钥校验我们的签名。
        const authHeader = req.headers["authorization"] as string | undefined;
        if (!authHeader) {
          state.signatureRejects++;
          return sendJson(res, 401, { code: "SIGN_ERROR", message: "no auth" });
        }
        const parsed = parseWechatAuth(authHeader);
        if (!parsed) {
          state.signatureRejects++;
          return sendJson(res, 401, { code: "SIGN_ERROR", message: "bad auth header" });
        }
        const signString = `${method}\n${url.pathname + url.search}\n${parsed.timestamp}\n${parsed.nonce_str}\n${body}\n`;
        const ok = createVerify("RSA-SHA256")
          .update(signString)
          .verify(merchant.publicKey, Buffer.from(parsed.signature, "base64"));
        if (!ok) {
          state.signatureRejects++;
          return sendJson(res, 401, { code: "SIGN_ERROR", message: "bad signature", signString });
        }
        if (path === "/v3/pay/transactions/native" && method === "POST") {
          const parsedBody = JSON.parse(body) as {
            out_trade_no: string;
            amount: { total: number };
            description: string;
          };
          state.charges.set(parsedBody.out_trade_no, {
            provider: "wechat",
            amountCents: parsedBody.amount.total,
            subject: parsedBody.description,
          });
          return sendJson(res, 200, {
            code_url: `weixin://wxpay/bizpayurl?pr=fake_${parsedBody.out_trade_no}`,
          });
        }
        if (path === "/v3/pay/transactions/jsapi" && method === "POST") {
          const parsedBody = JSON.parse(body) as { out_trade_no: string; amount: { total: number }; description: string };
          state.charges.set(parsedBody.out_trade_no, {
            provider: "wechat",
            amountCents: parsedBody.amount.total,
            subject: parsedBody.description,
          });
          return sendJson(res, 200, { prepay_id: `wx_prepay_${parsedBody.out_trade_no}` });
        }
        if (path.startsWith("/v3/pay/transactions/out-trade-no/") && method === "GET") {
          // pathname like /v3/pay/transactions/out-trade-no/{orderNo}, query ?mchid=
          const segments = path.split("/");
          const orderNo = decodeURIComponent(segments[segments.length - 1]);
          const charge = state.charges.get(orderNo);
          if (!charge) return sendJson(res, 404, { code: "ORDER_NOT_EXISTS" });
          return sendJson(res, 200, {
            trade_state: "SUCCESS",
            transaction_id: `wx_tx_${orderNo}`,
            success_time: new Date().toISOString().replace(/\.\d{3}Z$/, "+00:00"),
            amount: { total: charge.amountCents, payer_total: charge.amountCents },
          });
        }
        if (path === "/v3/refund/domestic/refunds" && method === "POST") {
          return sendJson(res, 200, { status: "PROCESSING" });
        }
        return sendJson(res, 404, { code: "NOT_FOUND", message: path });
      }

      // ── Alipay ────────────────────────────────────────────────────
      // Provider 构造的是带 query 的 GET URL，但也可能 POST application/x-www-form-urlencoded（query / refund）。
      if (path === "/alipay/gateway.do" || path === "/gateway.do") {
        state.rawRequests.push({ provider: "alipay", path: url.pathname + url.search, body });
        // 解析参数：GET 走 query；POST 走 body form。
        const params: Record<string, string> = {};
        if (method === "GET") {
          url.searchParams.forEach((v, k) => (params[k] = v));
        } else {
          new URLSearchParams(body).forEach((v, k) => (params[k] = v));
        }
        // 验证应用签名：用应用公钥校验。
        const sig = params.sign;
        if (!sig) {
          state.signatureRejects++;
          return sendJson(res, 400, { error: "no sign" });
        }
        const signString = aliBuildSignString(params);
        const ok = createVerify("RSA-SHA256")
          .update(signString, "utf8")
          .verify(app.publicKey, Buffer.from(sig, "base64"));
        if (!ok) {
          state.signatureRejects++;
          return sendJson(res, 400, { error: "bad sign", signString });
        }
        const m = params.method;
        if (m === "alipay.trade.page.pay" || m === "alipay.trade.wap.pay") {
          const biz = JSON.parse(params.biz_content) as { out_trade_no: string; total_amount: string; subject: string };
          state.charges.set(biz.out_trade_no, {
            provider: "alipay",
            amountCents: Math.round(Number(biz.total_amount) * 100),
            subject: biz.subject,
          });
          // 真实支付宝在 GET 返回 HTML 自动表单；我们返回简单 200 OK。
          return sendText(res, 200, `<html><body>fake alipay cashier for ${biz.out_trade_no}</body></html>`, "text/html; charset=utf-8");
        }
        if (m === "alipay.trade.query") {
          const biz = JSON.parse(params.biz_content) as { out_trade_no: string };
          const charge = state.charges.get(biz.out_trade_no);
          if (!charge) {
            return sendJson(res, 200, { alipay_trade_query_response: { code: "40004", msg: "ORDER_NOT_EXISTS" } });
          }
          return sendJson(res, 200, {
            alipay_trade_query_response: {
              code: "10000",
              msg: "Success",
              trade_status: "TRADE_SUCCESS",
              trade_no: `ali_tx_${biz.out_trade_no}`,
              send_pay_date: "2026-06-06 18:00:30",
              total_amount: (charge.amountCents / 100).toFixed(2),
            },
          });
        }
        if (m === "alipay.trade.refund") {
          return sendJson(res, 200, {
            alipay_trade_refund_response: { code: "10000", msg: "Success" },
          });
        }
        return sendJson(res, 400, { error: `unknown method ${m}` });
      }

      sendText(res, 404, `not found: ${path}`);
    } catch (e) {
      sendJson(res, 500, { error: String(e) });
    }
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const addr = server.address() as AddressInfo;
  const port = addr.port;
  const url = `http://127.0.0.1:${port}`;

  async function simulatePaid(args: {
    provider: "wechat" | "alipay";
    targetWebhookBase: string;
    orderNo: string;
    amountCents: number;
    transactionId?: string;
  }): Promise<{ status: number; body: string }> {
    if (args.provider === "wechat") {
      const tradeNo = args.transactionId ?? `wx_tx_${args.orderNo}`;
      const successTime = new Date().toISOString().replace(/\.\d{3}Z$/, "+00:00");
      const resource = {
        out_trade_no: args.orderNo,
        transaction_id: tradeNo,
        trade_state: "SUCCESS",
        success_time: successTime,
        amount: { total: args.amountCents, payer_total: args.amountCents },
      };
      const plaintext = Buffer.from(JSON.stringify(resource), "utf8");
      const key = Buffer.from(wechat.apiV3Key, "utf8");
      // WeChat 实际下发的 resource.nonce 是 12 字符 ASCII；我们的 decrypt 也用 utf8 解码，
      // 因此必须保证 nonce 的 byte length 与 char length 一致（纯 ASCII）。
      const asciiNonce = randomBytes(9).toString("base64").slice(0, 12).replace(/[+/=]/g, "a");
      const nonceBuf = Buffer.from(asciiNonce, "utf8");
      const aad = Buffer.from("transaction", "utf8");
      const cipher = createCipheriv("aes-256-gcm", key, nonceBuf);
      cipher.setAAD(aad);
      const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
      const authTag = cipher.getAuthTag();
      const ciphertext = Buffer.concat([encrypted, authTag]).toString("base64");
      const callbackBody = JSON.stringify({
        id: `evt_${args.orderNo}`,
        create_time: successTime,
        event_type: "TRANSACTION.SUCCESS",
        resource_type: "encrypt-resource",
        resource: {
          algorithm: "AEAD_AES_256_GCM",
          ciphertext,
          associated_data: "transaction",
          nonce: asciiNonce,
        },
      });
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonceStr = randomBytes(8).toString("hex");
      const signString = `${timestamp}\n${nonceStr}\n${callbackBody}\n`;
      const signature = createSign("RSA-SHA256")
        .update(signString)
        .sign(platform.privateKey, "base64");
      const resp = await fetch(`${args.targetWebhookBase}/api/payments/webhook/wechat_pay`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Wechatpay-Timestamp": timestamp,
          "Wechatpay-Nonce": nonceStr,
          "Wechatpay-Signature": signature,
          "Wechatpay-Serial": wechat.serialNo,
        },
        body: callbackBody,
      });
      return { status: resp.status, body: await resp.text() };
    }
    // Alipay 异步通知
    const tradeNo = args.transactionId ?? `ali_tx_${args.orderNo}`;
    const fields: Record<string, string> = {
      app_id: alipay.appId,
      auth_app_id: alipay.appId,
      charset: "utf-8",
      gmt_create: "2026-06-06 18:00:00",
      gmt_payment: "2026-06-06 18:00:30",
      notify_id: `notify_${args.orderNo}`,
      notify_time: "2026-06-06 18:00:31",
      notify_type: "trade_status_sync",
      out_trade_no: args.orderNo,
      total_amount: (args.amountCents / 100).toFixed(2),
      trade_no: tradeNo,
      trade_status: "TRADE_SUCCESS",
      version: "1.0",
      sign_type: "RSA2",
    };
    const signString = aliBuildSignString(fields);
    const sig = createSign("RSA-SHA256")
      .update(signString, "utf8")
      .sign(ali.privateKey, "base64");
    fields.sign = sig;
    const body = new URLSearchParams(fields).toString();
    const resp = await fetch(`${args.targetWebhookBase}/api/payments/webhook/alipay`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    return { status: resp.status, body: await resp.text() };
  }

  function stop(): Promise<void> {
    return new Promise((resolve) => server.close(() => resolve()));
  }

  return { url, port, wechat, alipay, state, simulatePaid, stop };
}

/** 把 fake PSP 的密钥灌进 process.env，方便测试启动前 setenv 再 dynamic import provider。 */
export function applyFakePspEnv(server: FakePspServer): void {
  process.env.WECHAT_PAY_APP_ID = server.wechat.appId;
  process.env.WECHAT_PAY_MCH_ID = server.wechat.mchId;
  process.env.WECHAT_PAY_SERIAL_NO = server.wechat.serialNo;
  process.env.WECHAT_PAY_API_V3_KEY = server.wechat.apiV3Key;
  process.env.WECHAT_PAY_PRIVATE_KEY = server.wechat.merchantPrivateKeyPem;
  process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY = server.wechat.platformPublicKeyPem;
  process.env.WECHAT_API_BASE = server.url;
  process.env.ALIPAY_APP_ID = server.alipay.appId;
  process.env.ALIPAY_APP_PRIVATE_KEY = server.alipay.appPrivateKeyPem;
  process.env.ALIPAY_PUBLIC_KEY = server.alipay.alipayPublicKeyPem;
  process.env.ALIPAY_GATEWAY = `${server.url}/alipay/gateway.do`;
}

// silence ts unused
void createPrivateKey;
void createPublicKey;
