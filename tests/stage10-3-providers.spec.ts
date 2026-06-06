import {
  createPrivateKey,
  createSign,
  createCipheriv,
  generateKeyPairSync,
} from "node:crypto";

import { expect, test } from "@playwright/test";

/**
 * Stage 10.3 验收 —— 真实支付通道 sign / verify 单元测试（无网络、无 server）。
 *
 * 思路：
 *  - 用 Node 现场生成 RSA 2048 密钥对扮演「商户私钥 / 平台公钥」，绕过缺真实凭据。
 *  - 注入 env → 动态 import provider 模块 → 走 verifyWebhook 真正执行验签 + 解密。
 *  - 测试聚焦签名串构造、AEAD-GCM 解密、Alipay 异步通知字段筛选、时间戳防重放。
 *
 *  Run: npx playwright test stage10-3-providers
 *  （此 spec 不访问 page，故即使 dev server 没起也能跑。）
 */

function makeRsaKeyPair() {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  return {
    privatePem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    publicPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
    privateKey,
    publicKey,
  };
}

function setEnvForWechat(env: NodeJS.ProcessEnv) {
  const merchant = makeRsaKeyPair();
  const platform = makeRsaKeyPair();
  env.WECHAT_PAY_APP_ID = "wxtestappid";
  env.WECHAT_PAY_MCH_ID = "1234567890";
  env.WECHAT_PAY_SERIAL_NO = "TESTSERIAL01";
  env.WECHAT_PAY_API_V3_KEY = "0123456789abcdef0123456789abcdef"; // 32 bytes utf8
  env.WECHAT_PAY_PRIVATE_KEY = merchant.privatePem;
  env.WECHAT_PAY_PLATFORM_PUBLIC_KEY = platform.publicPem;
  return { merchant, platform };
}

test.describe("Stage 10.3 · WeChat Pay v3 verifyWebhook", () => {
  test("AEAD_AES_256_GCM 回调 + 平台签名 → ORDER_PAID", async () => {
    Object.keys(process.env)
      .filter((k) => k.startsWith("WECHAT_PAY_"))
      .forEach((k) => {
        delete process.env[k];
      });
    const { platform } = setEnvForWechat(process.env);
    const mod = await import("../src/lib/payments/wechat");
    mod.__resetWechatConfigForTests();

    // 构造业务 plaintext + AEAD-GCM 加密。
    const orderNo = "20260606010101deadbeef";
    const tradeNo = "4200001234567890";
    const successTime = new Date("2026-06-06T10:00:00Z").toISOString();
    const resource = {
      out_trade_no: orderNo,
      transaction_id: tradeNo,
      trade_state: "SUCCESS",
      success_time: successTime,
      amount: { total: 9900, payer_total: 9900 },
    };
    const plaintext = Buffer.from(JSON.stringify(resource), "utf8");
    const key = Buffer.from("0123456789abcdef0123456789abcdef", "utf8");
    const nonce = "abcdef1234567890"; // 12-16 bytes 都接受；微信用 12 字节 ascii。
    const nonceBuf = Buffer.from(nonce, "utf8").subarray(0, 12);
    const aad = Buffer.from("transaction", "utf8");
    const cipher = createCipheriv("aes-256-gcm", key, nonceBuf);
    cipher.setAAD(aad);
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const ciphertext = Buffer.concat([encrypted, authTag]).toString("base64");

    const body = JSON.stringify({
      id: "evt_1",
      create_time: successTime,
      event_type: "TRANSACTION.SUCCESS",
      resource_type: "encrypt-resource",
      resource: {
        algorithm: "AEAD_AES_256_GCM",
        ciphertext,
        associated_data: "transaction",
        nonce: nonceBuf.toString("utf8"),
      },
    });

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const wxNonce = "wxnonce-1";
    const signString = `${timestamp}\n${wxNonce}\n${body}\n`;
    const signature = createSign("RSA-SHA256")
      .update(signString)
      .sign(createPrivateKey(platform.privatePem), "base64");

    const headers = new Headers({
      "wechatpay-timestamp": timestamp,
      "wechatpay-nonce": wxNonce,
      "wechatpay-signature": signature,
    });
    const event = await mod.wechatProvider.verifyWebhook(body, headers);
    expect(event).not.toBeNull();
    expect(event!.type).toBe("ORDER_PAID");
    expect(event!.orderNo).toBe(orderNo);
    expect(event!.transactionId).toBe(tradeNo);
    expect(event!.amountCents).toBe(9900);
  });

  test("篡改 body → 验签失败 → null", async () => {
    setEnvForWechat(process.env);
    const mod = await import("../src/lib/payments/wechat");
    mod.__resetWechatConfigForTests();
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const headers = new Headers({
      "wechatpay-timestamp": timestamp,
      "wechatpay-nonce": "n",
      "wechatpay-signature": "ZmFrZQ==",
    });
    const event = await mod.wechatProvider.verifyWebhook("{}", headers);
    expect(event).toBeNull();
  });

  test("timestamp 漂移 > 5min → null", async () => {
    const { platform } = setEnvForWechat(process.env);
    const mod = await import("../src/lib/payments/wechat");
    mod.__resetWechatConfigForTests();
    const body = JSON.stringify({});
    const old = (Math.floor(Date.now() / 1000) - 60 * 60).toString();
    const nonce = "n";
    const signString = `${old}\n${nonce}\n${body}\n`;
    const signature = createSign("RSA-SHA256")
      .update(signString)
      .sign(createPrivateKey(platform.privatePem), "base64");
    const headers = new Headers({
      "wechatpay-timestamp": old,
      "wechatpay-nonce": nonce,
      "wechatpay-signature": signature,
    });
    const event = await mod.wechatProvider.verifyWebhook(body, headers);
    expect(event).toBeNull();
  });
});

function setEnvForAlipay(env: NodeJS.ProcessEnv) {
  const app = makeRsaKeyPair();
  const alipay = makeRsaKeyPair();
  env.ALIPAY_APP_ID = "2026000001";
  env.ALIPAY_APP_PRIVATE_KEY = app.privatePem;
  env.ALIPAY_PUBLIC_KEY = alipay.publicPem;
  env.ALIPAY_GATEWAY = "https://openapi.alipaydev.com/gateway.do";
  return { app, alipay };
}

test.describe("Stage 10.3 · Alipay verifyWebhook", () => {
  test("典型异步通知（剔除 sign 后 RSA2 验签）→ ORDER_PAID", async () => {
    Object.keys(process.env)
      .filter((k) => k.startsWith("ALIPAY_"))
      .forEach((k) => {
        delete process.env[k];
      });
    const { alipay } = setEnvForAlipay(process.env);
    const mod = await import("../src/lib/payments/alipay");
    mod.__resetAlipayConfigForTests();

    const orderNo = "20260606010102cafebabe";
    const tradeNo = "2026060622001445720512345678";
    const fields: Record<string, string> = {
      app_id: "2026000001",
      auth_app_id: "2026000001",
      charset: "utf-8",
      gmt_create: "2026-06-06 18:00:00",
      gmt_payment: "2026-06-06 18:00:30",
      notify_id: "ACTNOTIFY_xxx",
      notify_time: "2026-06-06 18:00:31",
      notify_type: "trade_status_sync",
      out_trade_no: orderNo,
      total_amount: "99.00",
      trade_no: tradeNo,
      trade_status: "TRADE_SUCCESS",
      version: "1.0",
      sign_type: "RSA2",
    };
    const signString = mod.buildAlipaySignString(fields);
    const sig = createSign("RSA-SHA256")
      .update(signString, "utf8")
      .sign(createPrivateKey(alipay.privatePem), "base64");
    fields.sign = sig;

    const body = new URLSearchParams(fields).toString();
    const event = await mod.alipayProvider.verifyWebhook(body, new Headers());
    expect(event).not.toBeNull();
    expect(event!.type).toBe("ORDER_PAID");
    expect(event!.orderNo).toBe(orderNo);
    expect(event!.transactionId).toBe(tradeNo);
    expect(event!.amountCents).toBe(9900);
  });

  test("buildAlipaySignString 剔除 sign / sign_type / 空值并按字典序", async () => {
    setEnvForAlipay(process.env);
    const mod = await import("../src/lib/payments/alipay");
    mod.__resetAlipayConfigForTests();
    const s = mod.buildAlipaySignString({
      b: "2",
      a: "1",
      sign: "should-be-dropped",
      sign_type: "RSA2",
      empty: "",
      c: "3",
    });
    expect(s).toBe("a=1&b=2&c=3");
  });

  test("签名后修改 total_amount → 验签失败 → null", async () => {
    const { alipay } = setEnvForAlipay(process.env);
    const mod = await import("../src/lib/payments/alipay");
    mod.__resetAlipayConfigForTests();
    const fields: Record<string, string> = {
      app_id: "2026000001",
      charset: "utf-8",
      out_trade_no: "20260606010103beefcafe",
      total_amount: "1.00",
      trade_no: "20260606xxx",
      trade_status: "TRADE_SUCCESS",
      gmt_payment: "2026-06-06 18:00:30",
      sign_type: "RSA2",
    };
    const sig = createSign("RSA-SHA256")
      .update(mod.buildAlipaySignString(fields), "utf8")
      .sign(createPrivateKey(alipay.privatePem), "base64");
    fields.sign = sig;
    fields.total_amount = "99.00"; // 攻击者改金额但没重新签
    const body = new URLSearchParams(fields).toString();
    const event = await mod.alipayProvider.verifyWebhook(body, new Headers());
    expect(event).toBeNull();
  });
});

test.describe("Stage 10.3 · /api/cron/expire-orders 鉴权", () => {
  // 不能在测试进程里改 server 端 env，所以只测「无 Authorization」这条无论
  // CRON_SECRET 是否配置都应 403 的路径。
  test("无 Authorization → 403", async ({ request }) => {
    const resp = await request.post("/api/cron/expire-orders");
    expect(resp.status()).toBe(403);
  });

  test("错误 Authorization → 403", async ({ request }) => {
    const resp = await request.post("/api/cron/expire-orders", {
      headers: { Authorization: "Bearer wrong-secret" },
    });
    expect(resp.status()).toBe(403);
  });
});
