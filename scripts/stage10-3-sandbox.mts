/**
 * Stage 10.3 联调 — 本地 fake PSP + tsx 跑 wechat / alipay provider 全链路。
 *
 * 不依赖 Playwright，纯 Node。可直接：
 *   npx tsx scripts/stage10-3-sandbox.mts
 *
 * 退出码 0 = 全 PASS；非 0 = 至少一项失败。
 */

import { startFakePsp, applyFakePspEnv } from "../tests/helpers/fake-psp";

interface Case {
  name: string;
  run(): Promise<void>;
}

const cases: Case[] = [];
function defineCase(name: string, run: () => Promise<void>) {
  cases.push({ name, run });
}

function ok(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error("assertion failed: " + msg);
}

function clearProviderEnv() {
  for (const k of Object.keys(process.env)) {
    if (k.startsWith("WECHAT_") || k.startsWith("ALIPAY_") || k === "WECHAT_API_BASE") {
      delete process.env[k];
    }
  }
}

defineCase("wechat · createCharge NATIVE 通过 fake PSP 验签 + code_url", async () => {
  const psp = await startFakePsp();
  try {
    clearProviderEnv();
    applyFakePspEnv(psp);
    const wx = await import("../src/lib/payments/wechat");
    wx.__resetWechatConfigForTests();
    const r = await wx.wechatProvider.createCharge({
      orderNo: "20260606010101wxnative",
      amountCents: 4900,
      currency: "CNY",
      subject: "Pro Monthly",
      returnUrl: "http://localhost:3000/checkout/20260606010101wxnative",
      notifyUrl: "http://localhost:3000/api/payments/webhook/wechat_pay",
      expiresAt: new Date(Date.now() + 30 * 60_000),
    });
    ok(r.paymentUrl.startsWith("weixin://wxpay/"), "paymentUrl should be weixin:// scheme");
    ok(psp.state.signatureRejects === 0, "fake PSP should accept merchant signature");
    ok(psp.state.charges.get("20260606010101wxnative")?.amountCents === 4900, "charge amount should match");
  } finally {
    await psp.stop();
  }
});

defineCase("wechat · createCharge JSAPI 验签 + prepay_id + jsapiInvoke 6 字段 + paySign 可验签", async () => {
  const psp = await startFakePsp();
  try {
    clearProviderEnv();
    applyFakePspEnv(psp);
    const wx = await import("../src/lib/payments/wechat");
    wx.__resetWechatConfigForTests();
    const orderNo = "20260606010102wxjsapi";
    const r = await wx.wechatProvider.createCharge({
      orderNo,
      amountCents: 9900,
      currency: "CNY",
      subject: "Pro Annual",
      returnUrl: "http://localhost:3000/checkout/" + orderNo,
      notifyUrl: "http://localhost:3000/api/payments/webhook/wechat_pay",
      expiresAt: new Date(Date.now() + 30 * 60_000),
      attach: { scene: "JSAPI", openid: "oTestOpenid" },
    });
    ok(r.paymentUrl.includes("provider=wechat_pay"), "should embed provider param");
    ok(r.paymentUrl.includes("scene=jsapi"), "should embed scene=jsapi");
    ok(!r.paymentUrl.includes("prepayId="), "paymentUrl must NOT carry prepay_id (audit #2)");
    ok(!r.paymentUrl.includes("paySign"), "paymentUrl must NEVER contain paySign");
    ok(r.transactionId === orderNo, "transactionId should be orderNo not prepay_id");
    ok(psp.state.signatureRejects === 0, "fake PSP should accept signature");
    // 校验 jsapiInvoke 6 字段
    const j = r.jsapiInvoke;
    ok(j !== undefined, "jsapiInvoke should be set for JSAPI");
    ok(j.appId === psp.wechat.appId, "appId");
    ok(typeof j.timeStamp === "string" && /^\d+$/.test(j.timeStamp), "timeStamp is numeric string");
    ok(j.nonceStr.length === 32, "nonceStr should be 32 hex");
    ok(j.package.startsWith("prepay_id="), "package format");
    ok(j.signType === "RSA", "signType");
    ok(typeof j.paySign === "string" && j.paySign.length > 0, "paySign present");
    // 用「商户公钥」验 paySign（fake PSP 持有商户公钥的派生形式）
    const { createVerify, createPublicKey } = await import("node:crypto");
    const merchantPriv = createPublicKey({
      key: psp.wechat.merchantPrivateKeyPem,
      format: "pem",
    });
    const canonical = `${j.appId}\n${j.timeStamp}\n${j.nonceStr}\n${j.package}\n`;
    const verifyOk = createVerify("RSA-SHA256")
      .update(canonical)
      .verify(merchantPriv, Buffer.from(j.paySign, "base64"));
    ok(verifyOk, "paySign must verify against merchant pubkey");
  } finally {
    await psp.stop();
  }
});

defineCase("wechat · createCharge JSAPI 缺 openid → throw", async () => {
  const psp = await startFakePsp();
  try {
    clearProviderEnv();
    applyFakePspEnv(psp);
    const wx = await import("../src/lib/payments/wechat");
    wx.__resetWechatConfigForTests();
    let threw = false;
    try {
      await wx.wechatProvider.createCharge({
        orderNo: "20260606010103wxjsapi",
        amountCents: 1000,
        currency: "CNY",
        subject: "x",
        returnUrl: "http://x/c",
        notifyUrl: "http://x/n",
        expiresAt: new Date(Date.now() + 60_000),
        attach: { scene: "JSAPI" },
      });
    } catch (e) {
      threw = String(e).includes("openid");
    }
    ok(threw, "JSAPI without openid should throw");
  } finally {
    await psp.stop();
  }
});

defineCase("wechat · queryStatus 验签 + SUCCESS → PAID", async () => {
  const psp = await startFakePsp();
  try {
    clearProviderEnv();
    applyFakePspEnv(psp);
    const wx = await import("../src/lib/payments/wechat");
    wx.__resetWechatConfigForTests();
    const orderNo = "20260606010104wxquery";
    await wx.wechatProvider.createCharge({
      orderNo,
      amountCents: 100,
      currency: "CNY",
      subject: "q",
      returnUrl: "http://x/c",
      notifyUrl: "http://x/n",
      expiresAt: new Date(Date.now() + 60_000),
    });
    const status = await wx.wechatProvider.queryStatus("ignored", orderNo);
    ok(status.status === "PAID", `status should be PAID, got ${status.status}`);
    ok(status.transactionId === `wx_tx_${orderNo}`, "transactionId mismatch");
    ok(status.amountCents === 100, "amountCents mismatch");
    ok(psp.state.signatureRejects === 0, "fake PSP should accept signature");
  } finally {
    await psp.stop();
  }
});

defineCase("wechat · refund 验签 + ok", async () => {
  const psp = await startFakePsp();
  try {
    clearProviderEnv();
    applyFakePspEnv(psp);
    const wx = await import("../src/lib/payments/wechat");
    wx.__resetWechatConfigForTests();
    const r = await wx.wechatProvider.refund({
      orderNo: "20260606010105wxrefund",
      transactionId: "wx_tx_xxx",
      amountCents: 100,
      originalAmountCents: 100,
      idempotencyKey: "Rtest_wx_refund_001",
      reason: "test",
    });
    ok(r.ok, "refund should be ok");
    ok(psp.state.signatureRejects === 0, "fake PSP should accept signature");
  } finally {
    await psp.stop();
  }
});

defineCase("wechat · verifyWebhook 用 fake 平台私钥签名的回调 → ORDER_PAID", async () => {
  const psp = await startFakePsp();
  try {
    clearProviderEnv();
    applyFakePspEnv(psp);
    const wx = await import("../src/lib/payments/wechat");
    wx.__resetWechatConfigForTests();
    const { createServer } = await import("node:http");
    const captured: { body: string; headers: Record<string, string> } = { body: "", headers: {} };
    const echo = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c as Buffer));
      req.on("end", () => {
        captured.body = Buffer.concat(chunks).toString("utf8");
        captured.headers = Object.fromEntries(
          Object.entries(req.headers).map(([k, v]) => [k, String(v)]),
        );
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end("{}");
      });
    });
    await new Promise<void>((resolve) => echo.listen(0, "127.0.0.1", () => resolve()));
    const port = (echo.address() as { port: number }).port;
    await psp.simulatePaid({
      provider: "wechat",
      targetWebhookBase: `http://127.0.0.1:${port}`,
      orderNo: "20260606010106wxcb",
      amountCents: 4900,
    });
    await new Promise<void>((resolve) => echo.close(() => resolve()));
    const headers = new Headers(captured.headers);
    const event = await wx.wechatProvider.verifyWebhook(captured.body, headers);
    ok(event !== null, "verifyWebhook should accept fake-PSP-signed body");
    ok(event!.type === "ORDER_PAID", "event type");
    ok(event!.orderNo === "20260606010106wxcb", "orderNo");
    ok(event!.amountCents === 4900, "amountCents");
  } finally {
    await psp.stop();
  }
});

defineCase("wechat · 多平台公钥（Wechatpay-Serial 命中正确证书）→ ORDER_PAID（audit #1）", async () => {
  const psp = await startFakePsp();
  try {
    clearProviderEnv();
    applyFakePspEnv(psp);
    // 把单证书 env 改成多证书 JSON map：包括 fake psp 当前在用的 platform key + 一把假的额外 key。
    const { generateKeyPairSync } = await import("node:crypto");
    const stale = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const realSerial = psp.wechat.serialNo;
    const staleSerial = "OLD_SERIAL_2025";
    delete process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY;
    process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEYS = JSON.stringify({
      [realSerial]: psp.wechat.platformPublicKeyPem,
      [staleSerial]: stale.publicKey.export({ type: "spki", format: "pem" }).toString(),
    });
    const wx = await import("../src/lib/payments/wechat");
    wx.__resetWechatConfigForTests();
    // simulatePaid 会用 fake psp 的 platformPrivateKey 签名，并发 Wechatpay-Serial = realSerial。
    const { createServer } = await import("node:http");
    const captured: { body: string; headers: Record<string, string> } = { body: "", headers: {} };
    const echo = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c as Buffer));
      req.on("end", () => {
        captured.body = Buffer.concat(chunks).toString("utf8");
        captured.headers = Object.fromEntries(
          Object.entries(req.headers).map(([k, v]) => [k, String(v)]),
        );
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end("{}");
      });
    });
    await new Promise<void>((resolve) => echo.listen(0, "127.0.0.1", () => resolve()));
    const port = (echo.address() as { port: number }).port;
    await psp.simulatePaid({
      provider: "wechat",
      targetWebhookBase: `http://127.0.0.1:${port}`,
      orderNo: "20260606010120wxserial",
      amountCents: 999,
    });
    await new Promise<void>((resolve) => echo.close(() => resolve()));
    const event = await wx.wechatProvider.verifyWebhook(
      captured.body,
      new Headers(captured.headers),
    );
    ok(event !== null, "multi-key verifyWebhook must accept correct serial");
    ok(event!.type === "ORDER_PAID", "type");
    delete process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEYS;
  } finally {
    await psp.stop();
  }
});

defineCase("alipay · createCharge PAGE 验签 + cashier URL 可访问", async () => {
  const psp = await startFakePsp();
  try {
    clearProviderEnv();
    applyFakePspEnv(psp);
    const ali = await import("../src/lib/payments/alipay");
    ali.__resetAlipayConfigForTests();
    const orderNo = "20260606010201alipage";
    const r = await ali.alipayProvider.createCharge({
      orderNo,
      amountCents: 9900,
      currency: "CNY",
      subject: "Pro Annual",
      returnUrl: "http://localhost:3000/checkout/" + orderNo,
      notifyUrl: "http://localhost:3000/api/payments/webhook/alipay",
      expiresAt: new Date(Date.now() + 30 * 60_000),
    });
    ok(r.paymentUrl.startsWith(psp.url), `paymentUrl should be on fake PSP, got ${r.paymentUrl.slice(0, 60)}`);
    ok(r.paymentUrl.includes("alipay.trade.page.pay"), "method should be page.pay");
    const resp = await fetch(r.paymentUrl);
    ok(resp.status === 200, `cashier URL should 200 (got ${resp.status})`);
    ok(psp.state.signatureRejects === 0, "fake PSP should accept signature");
    ok(psp.state.charges.get(orderNo)?.amountCents === 9900, "amount snapshot");
  } finally {
    await psp.stop();
  }
});

defineCase("alipay · createCharge WAP → QUICK_WAP_WAY", async () => {
  const psp = await startFakePsp();
  try {
    clearProviderEnv();
    applyFakePspEnv(psp);
    const ali = await import("../src/lib/payments/alipay");
    ali.__resetAlipayConfigForTests();
    const orderNo = "20260606010202aliwap";
    const r = await ali.alipayProvider.createCharge({
      orderNo,
      amountCents: 1900,
      currency: "CNY",
      subject: "Pro Trial",
      returnUrl: "http://x/c",
      notifyUrl: "http://x/n",
      expiresAt: new Date(Date.now() + 60_000),
      attach: { scene: "WAP" },
    });
    ok(r.paymentUrl.includes("alipay.trade.wap.pay"), "method should be wap.pay");
    const u = new URL(r.paymentUrl);
    const biz = JSON.parse(u.searchParams.get("biz_content") ?? "{}") as { product_code: string };
    ok(biz.product_code === "QUICK_WAP_WAY", `product_code should be QUICK_WAP_WAY, got ${biz.product_code}`);
  } finally {
    await psp.stop();
  }
});

defineCase("alipay · queryStatus 验签 + TRADE_SUCCESS → PAID", async () => {
  const psp = await startFakePsp();
  try {
    clearProviderEnv();
    applyFakePspEnv(psp);
    const ali = await import("../src/lib/payments/alipay");
    ali.__resetAlipayConfigForTests();
    const orderNo = "20260606010203aliquery";
    const charge = await ali.alipayProvider.createCharge({
      orderNo,
      amountCents: 100,
      currency: "CNY",
      subject: "x",
      returnUrl: "http://x/c",
      notifyUrl: "http://x/n",
      expiresAt: new Date(Date.now() + 60_000),
    });
    // Alipay createCharge 仅构造签名 URL —— 真实场景下「用户落到收银台」才把订单注册到 Alipay。
    // 在 fake PSP 里模拟一次访问以触发同样的状态登记。
    await fetch(charge.paymentUrl);
    const status = await ali.alipayProvider.queryStatus("ignored", orderNo);
    ok(status.status === "PAID", `status should be PAID, got ${status.status}`);
    ok(status.transactionId === `ali_tx_${orderNo}`, "transactionId");
    ok(status.amountCents === 100, "amount");
  } finally {
    await psp.stop();
  }
});

defineCase("alipay · refund 验签 + ok", async () => {
  const psp = await startFakePsp();
  try {
    clearProviderEnv();
    applyFakePspEnv(psp);
    const ali = await import("../src/lib/payments/alipay");
    ali.__resetAlipayConfigForTests();
    const r = await ali.alipayProvider.refund({
      orderNo: "20260606010204alirefund",
      transactionId: null,
      amountCents: 100,
      originalAmountCents: 100,
      idempotencyKey: "Rtest_ali_refund_001",
    });
    ok(r.ok, "refund ok");
  } finally {
    await psp.stop();
  }
});

defineCase("alipay · 时间戳为 Asia/Shanghai（+08:00），而不是 UTC（audit #6）", async () => {
  const psp = await startFakePsp();
  try {
    clearProviderEnv();
    applyFakePspEnv(psp);
    const ali = await import("../src/lib/payments/alipay");
    ali.__resetAlipayConfigForTests();
    const orderNo = "20260606010210alitz";
    const fixedExpiry = new Date("2026-06-06T02:30:00Z");
    const r = await ali.alipayProvider.createCharge({
      orderNo,
      amountCents: 100,
      currency: "CNY",
      subject: "tz check",
      returnUrl: "http://x/c",
      notifyUrl: "http://x/n",
      expiresAt: fixedExpiry,
    });
    const u = new URL(r.paymentUrl);
    // UTC 02:30:00 + 8h = 10:30:00 Asia/Shanghai
    const biz = JSON.parse(u.searchParams.get("biz_content") ?? "{}") as { time_expire: string };
    ok(biz.time_expire === "2026-06-06 10:30:00", `time_expire should be Shanghai-local, got ${biz.time_expire}`);
  } finally {
    await psp.stop();
  }
});

defineCase("alipay · webhook app_id 不匹配 → 拒签 null（audit #8）", async () => {
  const psp = await startFakePsp();
  try {
    clearProviderEnv();
    applyFakePspEnv(psp);
    const ali = await import("../src/lib/payments/alipay");
    ali.__resetAlipayConfigForTests();
    const { createSign } = await import("node:crypto");
    const fields: Record<string, string> = {
      app_id: "OTHER_MERCHANT_APP", // 我们配置的是 psp.alipay.appId，不是这个
      auth_app_id: "OTHER_MERCHANT_APP",
      charset: "utf-8",
      gmt_payment: "2026-06-06 18:00:30",
      notify_time: "2026-06-06 18:00:31",
      notify_type: "trade_status_sync",
      out_trade_no: "20260606010211alixapp",
      total_amount: "100.00",
      trade_no: "ali_tx_x",
      trade_status: "TRADE_SUCCESS",
      version: "1.0",
      sign_type: "RSA2",
    };
    // 用支付宝平台私钥签名 — 仅此签名会通过 RSA2 验签，让我们走到 app_id 检查路径。
    const signString = Object.keys(fields)
      .filter((k) => k !== "sign" && k !== "sign_type" && fields[k] !== "")
      .sort()
      .map((k) => `${k}=${fields[k]}`)
      .join("&");
    const sig = createSign("RSA-SHA256")
      .update(signString, "utf8")
      .sign(psp.alipay.alipayPrivateKey, "base64");
    fields.sign = sig;
    const body = new URLSearchParams(fields).toString();
    const event = await ali.alipayProvider.verifyWebhook(body, new Headers());
    ok(event === null, "verifyWebhook must reject cross-merchant app_id");
  } finally {
    await psp.stop();
  }
});

defineCase("alipay · verifyWebhook 用 fake 支付宝私钥签名的异步通知 → ORDER_PAID", async () => {
  const psp = await startFakePsp();
  try {
    clearProviderEnv();
    applyFakePspEnv(psp);
    const ali = await import("../src/lib/payments/alipay");
    ali.__resetAlipayConfigForTests();
    const { createServer } = await import("node:http");
    const captured: { body: string } = { body: "" };
    const echo = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c as Buffer));
      req.on("end", () => {
        captured.body = Buffer.concat(chunks).toString("utf8");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end("{}");
      });
    });
    await new Promise<void>((resolve) => echo.listen(0, "127.0.0.1", () => resolve()));
    const port = (echo.address() as { port: number }).port;
    await psp.simulatePaid({
      provider: "alipay",
      targetWebhookBase: `http://127.0.0.1:${port}`,
      orderNo: "20260606010205alicb",
      amountCents: 1234,
    });
    await new Promise<void>((resolve) => echo.close(() => resolve()));
    const event = await ali.alipayProvider.verifyWebhook(captured.body, new Headers());
    ok(event !== null, "verifyWebhook should accept fake notify");
    ok(event!.type === "ORDER_PAID", "type");
    ok(event!.orderNo === "20260606010205alicb", "orderNo");
    ok(event!.amountCents === 1234, "amount");
  } finally {
    await psp.stop();
  }
});

async function main(): Promise<number> {
  let pass = 0;
  let fail = 0;
  for (const c of cases) {
    try {
      await c.run();
      console.log(`  PASS  ${c.name}`);
      pass++;
    } catch (e) {
      console.error(`  FAIL  ${c.name}`);
      console.error("        " + (e instanceof Error ? e.message : String(e)));
      if (e instanceof Error && e.stack) {
        console.error("        " + e.stack.split("\n").slice(1, 4).join("\n        "));
      }
      fail++;
    }
  }
  console.log(`\nStage 10.3 sandbox: ${pass} pass / ${fail} fail`);
  return fail === 0 ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error("sandbox harness crashed:", e);
    process.exit(2);
  },
);
