import { test, expect } from "@playwright/test";

import { applyFakePspEnv, startFakePsp } from "./helpers/fake-psp";

/**
 * Stage 10.3 联调 spec — 不打远端 PSP，而是用本地 fake PSP（tests/helpers/fake-psp.ts）
 * 接收商户请求并验签，再用对应「平台 / 支付宝」私钥给 webhook 签名打回。
 *
 * 这是「集成」级别测试：
 *   - 真实跑 wechatProvider / alipayProvider 全部 HTTP 链路（fetch）。
 *   - 真实跑签名 / 验签 / AEAD-GCM 加解密 全流程。
 *   - 任何签名串构造 bug、URL 编码 bug、key 编码 bug 在这里会直接暴露。
 *
 *  Run: npx playwright test stage10-3-live-flow
 *  （此 spec 不访问 page，故即使 dev server 没起也能跑。）
 */

test.describe("Stage 10.3 联调 · WeChat full HTTP loop", () => {
  test("createCharge NATIVE → fake PSP 验签通过 + code_url 回填", async () => {
    const psp = await startFakePsp();
    try {
      Object.keys(process.env)
        .filter((k) => k.startsWith("WECHAT_") || k.startsWith("ALIPAY_") || k === "WECHAT_API_BASE")
        .forEach((k) => delete process.env[k]);
      applyFakePspEnv(psp);
      const wx = await import("../src/lib/payments/wechat");
      wx.__resetWechatConfigForTests();
      const result = await wx.wechatProvider.createCharge({
        orderNo: "20260606010101wxnative",
        amountCents: 4900,
        currency: "CNY",
        subject: "Pro Monthly",
        returnUrl: "http://localhost:3000/checkout/20260606010101wxnative",
        notifyUrl: "http://localhost:3000/api/payments/webhook/wechat_pay",
        expiresAt: new Date(Date.now() + 30 * 60_000),
      });
      expect(result.paymentUrl.startsWith("weixin://wxpay/")).toBe(true);
      expect(psp.state.signatureRejects).toBe(0);
      expect(psp.state.charges.get("20260606010101wxnative")?.amountCents).toBe(4900);
    } finally {
      await psp.stop();
    }
  });

  test("createCharge JSAPI → fake PSP 验签 + prepay_id → 内部 checkout URL", async () => {
    const psp = await startFakePsp();
    try {
      applyFakePspEnv(psp);
      const wx = await import("../src/lib/payments/wechat");
      wx.__resetWechatConfigForTests();
      const orderNo = "20260606010102wxjsapi";
      const result = await wx.wechatProvider.createCharge({
        orderNo,
        amountCents: 9900,
        currency: "CNY",
        subject: "Pro Annual",
        returnUrl: "http://localhost:3000/checkout/" + orderNo,
        notifyUrl: "http://localhost:3000/api/payments/webhook/wechat_pay",
        expiresAt: new Date(Date.now() + 30 * 60_000),
        attach: { scene: "JSAPI", openid: "oTestOpenid" },
      });
      expect(result.paymentUrl).toContain("provider=wechat_pay");
      expect(result.paymentUrl).toContain("scene=jsapi");
      expect(result.paymentUrl).toContain("prepayId=");
      expect(result.transactionId.startsWith("wx_prepay_")).toBe(true);
      expect(psp.state.signatureRejects).toBe(0);
    } finally {
      await psp.stop();
    }
  });

  test("createCharge JSAPI 缺 openid → throw", async () => {
    const psp = await startFakePsp();
    try {
      applyFakePspEnv(psp);
      const wx = await import("../src/lib/payments/wechat");
      wx.__resetWechatConfigForTests();
      await expect(
        wx.wechatProvider.createCharge({
          orderNo: "20260606010103wxjsapi",
          amountCents: 1000,
          currency: "CNY",
          subject: "x",
          returnUrl: "http://x/c",
          notifyUrl: "http://x/n",
          expiresAt: new Date(Date.now() + 60_000),
          attach: { scene: "JSAPI" },
        }),
      ).rejects.toThrow(/openid/);
    } finally {
      await psp.stop();
    }
  });

  test("queryStatus → fake PSP 验签 + SUCCESS → PAID", async () => {
    const psp = await startFakePsp();
    try {
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
      expect(status.status).toBe("PAID");
      expect(status.transactionId).toBe(`wx_tx_${orderNo}`);
      expect(status.amountCents).toBe(100);
      expect(psp.state.signatureRejects).toBe(0);
    } finally {
      await psp.stop();
    }
  });

  test("refund → fake PSP 验签 + 200", async () => {
    const psp = await startFakePsp();
    try {
      applyFakePspEnv(psp);
      const wx = await import("../src/lib/payments/wechat");
      wx.__resetWechatConfigForTests();
      const r = await wx.wechatProvider.refund({
        orderNo: "20260606010105wxrefund",
        transactionId: "wx_tx_xxx",
        amountCents: 100,
        reason: "test",
      });
      expect(r.ok).toBe(true);
      expect(psp.state.signatureRejects).toBe(0);
    } finally {
      await psp.stop();
    }
  });

  test("verifyWebhook (fake PSP 签名) → ORDER_PAID 解密成功", async () => {
    const psp = await startFakePsp();
    try {
      applyFakePspEnv(psp);
      const wx = await import("../src/lib/payments/wechat");
      wx.__resetWechatConfigForTests();
      // 用 fake PSP 的 simulatePaid 构造 body + headers，然后直接喂 provider 验证。
      // 不通过真实 HTTP — 用一个本地 echo 服务器接收并把 body/headers 取出来。
      const { createServer } = await import("node:http");
      const captured: { body: string; headers: Record<string, string> } = {
        body: "",
        headers: {},
      };
      const echo = createServer(async (req, res) => {
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
      await new Promise<void>((resolve) =>
        echo.listen(0, "127.0.0.1", () => resolve()),
      );
      const addr = echo.address() as { port: number };
      const base = `http://127.0.0.1:${addr.port}`;
      await psp.simulatePaid({
        provider: "wechat",
        targetWebhookBase: base,
        orderNo: "20260606010106wxcb",
        amountCents: 4900,
      });
      await new Promise<void>((resolve) => echo.close(() => resolve()));
      const headers = new Headers(captured.headers);
      const event = await wx.wechatProvider.verifyWebhook(captured.body, headers);
      expect(event).not.toBeNull();
      expect(event!.type).toBe("ORDER_PAID");
      expect(event!.orderNo).toBe("20260606010106wxcb");
      expect(event!.amountCents).toBe(4900);
    } finally {
      await psp.stop();
    }
  });
});

test.describe("Stage 10.3 联调 · Alipay full HTTP loop", () => {
  test("createCharge PAGE → fake PSP 验签 + 返回 cashier URL", async () => {
    const psp = await startFakePsp();
    try {
      Object.keys(process.env)
        .filter((k) => k.startsWith("WECHAT_") || k.startsWith("ALIPAY_"))
        .forEach((k) => delete process.env[k]);
      applyFakePspEnv(psp);
      const ali = await import("../src/lib/payments/alipay");
      ali.__resetAlipayConfigForTests();
      const orderNo = "20260606010201alipage";
      const result = await ali.alipayProvider.createCharge({
        orderNo,
        amountCents: 9900,
        currency: "CNY",
        subject: "Pro Annual",
        returnUrl: "http://localhost:3000/checkout/" + orderNo,
        notifyUrl: "http://localhost:3000/api/payments/webhook/alipay",
        expiresAt: new Date(Date.now() + 30 * 60_000),
      });
      // URL 应指向 fake gateway，签名应通过 fake PSP 应用公钥验签
      expect(result.paymentUrl.startsWith(psp.url)).toBe(true);
      expect(result.paymentUrl).toContain("alipay.trade.page.pay");
      // 让 fake PSP 真的接收一次（client 在 createCharge 时不会自己 GET，只构造 URL）。
      const resp = await fetch(result.paymentUrl);
      expect(resp.status).toBe(200);
      expect(psp.state.signatureRejects).toBe(0);
      expect(psp.state.charges.get(orderNo)?.amountCents).toBe(9900);
    } finally {
      await psp.stop();
    }
  });

  test("createCharge WAP → product_code=QUICK_WAP_WAY", async () => {
    const psp = await startFakePsp();
    try {
      applyFakePspEnv(psp);
      const ali = await import("../src/lib/payments/alipay");
      ali.__resetAlipayConfigForTests();
      const orderNo = "20260606010202aliwap";
      const result = await ali.alipayProvider.createCharge({
        orderNo,
        amountCents: 1900,
        currency: "CNY",
        subject: "Pro Trial",
        returnUrl: "http://x/c",
        notifyUrl: "http://x/n",
        expiresAt: new Date(Date.now() + 60_000),
        attach: { scene: "WAP" },
      });
      expect(result.paymentUrl).toContain("alipay.trade.wap.pay");
      const u = new URL(result.paymentUrl);
      const biz = JSON.parse(u.searchParams.get("biz_content") ?? "{}");
      expect(biz.product_code).toBe("QUICK_WAP_WAY");
    } finally {
      await psp.stop();
    }
  });

  test("queryStatus → fake PSP 验签 + TRADE_SUCCESS → PAID", async () => {
    const psp = await startFakePsp();
    try {
      applyFakePspEnv(psp);
      const ali = await import("../src/lib/payments/alipay");
      ali.__resetAlipayConfigForTests();
      const orderNo = "20260606010203aliquery";
      await ali.alipayProvider.createCharge({
        orderNo,
        amountCents: 100,
        currency: "CNY",
        subject: "x",
        returnUrl: "http://x/c",
        notifyUrl: "http://x/n",
        expiresAt: new Date(Date.now() + 60_000),
      });
      const status = await ali.alipayProvider.queryStatus("ignored", orderNo);
      expect(status.status).toBe("PAID");
      expect(status.transactionId).toBe(`ali_tx_${orderNo}`);
      expect(status.amountCents).toBe(100);
    } finally {
      await psp.stop();
    }
  });

  test("refund → fake PSP 验签 + ok=true", async () => {
    const psp = await startFakePsp();
    try {
      applyFakePspEnv(psp);
      const ali = await import("../src/lib/payments/alipay");
      ali.__resetAlipayConfigForTests();
      const r = await ali.alipayProvider.refund({
        orderNo: "20260606010204alirefund",
        transactionId: null,
        amountCents: 100,
      });
      expect(r.ok).toBe(true);
    } finally {
      await psp.stop();
    }
  });

  test("verifyWebhook (fake 异步通知) → ORDER_PAID 验签成功", async () => {
    const psp = await startFakePsp();
    try {
      applyFakePspEnv(psp);
      const ali = await import("../src/lib/payments/alipay");
      ali.__resetAlipayConfigForTests();
      const { createServer } = await import("node:http");
      const captured: { body: string } = { body: "" };
      const echo = createServer(async (req, res) => {
        const chunks: Buffer[] = [];
        req.on("data", (c) => chunks.push(c as Buffer));
        req.on("end", () => {
          captured.body = Buffer.concat(chunks).toString("utf8");
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end("{}");
        });
      });
      await new Promise<void>((resolve) => echo.listen(0, "127.0.0.1", () => resolve()));
      const addr = echo.address() as { port: number };
      await psp.simulatePaid({
        provider: "alipay",
        targetWebhookBase: `http://127.0.0.1:${addr.port}`,
        orderNo: "20260606010205alicb",
        amountCents: 1234,
      });
      await new Promise<void>((resolve) => echo.close(() => resolve()));
      const event = await ali.alipayProvider.verifyWebhook(captured.body, new Headers());
      expect(event).not.toBeNull();
      expect(event!.type).toBe("ORDER_PAID");
      expect(event!.orderNo).toBe("20260606010205alicb");
      expect(event!.amountCents).toBe(1234);
    } finally {
      await psp.stop();
    }
  });
});
