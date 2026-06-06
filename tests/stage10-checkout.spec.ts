import { createHmac } from "node:crypto";

import { expect, test } from "@playwright/test";

import { loginAs } from "./helpers/auth";

/**
 * Stage 10.2 验收 —— 支付适配 + Mock provider + checkout 流程。
 *
 * 不依赖真实第三方网关；Mock provider 用 HMAC-SHA256 验签。
 *
 *  Run: npx playwright test stage10-checkout
 */

const ADMIN_EMAIL = "admin@aivideohub.com";
const MOCK_SECRET =
  process.env.PAYMENT_MOCK_SECRET || "seedland-dev-mock-secret";

function signMock(payload: {
  orderNo: string;
  amountCents: number;
  transactionId: string;
  paidAt: string;
}): string {
  const canonical = `orderNo=${payload.orderNo}&amountCents=${payload.amountCents}&transactionId=${payload.transactionId}&paidAt=${payload.paidAt}`;
  return createHmac("sha256", MOCK_SECRET).update(canonical).digest("hex");
}

async function sessionCookie(page: import("@playwright/test").Page) {
  const cookies = await page.context().cookies();
  const sess = cookies.find((c) => c.name === "seedland_session");
  if (!sess) throw new Error("session cookie missing");
  return `${sess.name}=${sess.value}`;
}

test.describe("Stage 10.2 · 支付 + checkout", () => {
  test("POST /api/orders 匿名 → 401", async ({ request }) => {
    const resp = await request.post("/api/orders", {
      data: { type: "MEMBERSHIP", planSlug: "pro-monthly", paymentMethod: "WECHAT_PAY" },
    });
    expect(resp.status()).toBe(401);
  });

  test("POST /api/orders 缺字段 → 400", async ({ page, request }) => {
    await loginAs(page, ADMIN_EMAIL);
    const cookie = await sessionCookie(page);
    const resp = await request.post("/api/orders", {
      headers: { cookie },
      data: { type: "MEMBERSHIP" }, // 缺 planSlug + paymentMethod
    });
    expect(resp.status()).toBe(400);
  });

  test("POST /api/orders 不存在的计划 → 404", async ({ page, request }) => {
    await loginAs(page, ADMIN_EMAIL);
    const cookie = await sessionCookie(page);
    const resp = await request.post("/api/orders", {
      headers: { cookie },
      data: {
        type: "MEMBERSHIP",
        planSlug: "__bad__",
        paymentMethod: "WECHAT_PAY",
      },
    });
    expect(resp.status()).toBe(404);
  });

  test("POST /api/orders 免费计划 → 400", async ({ page, request }) => {
    await loginAs(page, ADMIN_EMAIL);
    const cookie = await sessionCookie(page);
    const resp = await request.post("/api/orders", {
      headers: { cookie },
      data: {
        type: "MEMBERSHIP",
        planSlug: "free",
        paymentMethod: "WECHAT_PAY",
      },
    });
    expect(resp.status()).toBe(400);
  });

  test("POST /api/orders 创建会员订单 → 201 + orderNo + paymentUrl", async ({
    page,
    request,
  }) => {
    await loginAs(page, ADMIN_EMAIL);
    const cookie = await sessionCookie(page);
    const resp = await request.post("/api/orders", {
      headers: { cookie },
      data: {
        type: "MEMBERSHIP",
        planSlug: "pro-monthly",
        paymentMethod: "WECHAT_PAY",
      },
    });
    expect(resp.status()).toBe(201);
    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(typeof body.data.orderNo).toBe("string");
    expect(body.data.orderNo).toMatch(/^\d{14}[a-f0-9]{8}$/);
    expect(typeof body.data.paymentUrl).toBe("string");
    expect(body.data.amountCents).toBeGreaterThan(0);
    expect(body.data.currency).toBe("CNY");
    expect(typeof body.data.expiresAt).toBe("string");
  });

  test("GET /api/orders/<bad> → 404", async ({ page, request }) => {
    await loginAs(page, ADMIN_EMAIL);
    const cookie = await sessionCookie(page);
    const resp = await request.get("/api/orders/notarealorderno", {
      headers: { cookie },
    });
    expect(resp.status()).toBe(404);
  });

  test("GET /api/orders/<orderNo> 200 for owner", async ({ page, request }) => {
    await loginAs(page, ADMIN_EMAIL);
    const cookie = await sessionCookie(page);
    const create = await request.post("/api/orders", {
      headers: { cookie },
      data: {
        type: "MEMBERSHIP",
        planSlug: "pro-monthly",
        paymentMethod: "WECHAT_PAY",
      },
    });
    expect(create.status()).toBe(201);
    const { data: order } = await create.json();
    const detail = await request.get(`/api/orders/${order.orderNo}`, {
      headers: { cookie },
    });
    expect(detail.status()).toBe(200);
    const json = await detail.json();
    expect(json.data.status).toBe("PENDING");
    expect(json.data.orderNo).toBe(order.orderNo);
    expect(json.data.amountCents).toBe(order.amountCents);
  });

  test("/checkout/<orderNo> 匿名 → /auth/login", async ({ page }) => {
    await page.goto("/checkout/12345678901234abcdef0000", {
      waitUntil: "domcontentloaded",
    });
    expect(page.url()).toMatch(/\/auth\/login/);
    expect(decodeURIComponent(page.url())).toContain(
      "next=/checkout/12345678901234abcdef0000",
    );
  });

  test("/checkout/<bad-format> → 404", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL);
    const resp = await page.goto("/checkout/zzz-bad", {
      waitUntil: "domcontentloaded",
    });
    expect(resp?.status()).toBe(404);
  });

  test("POST /api/payments/webhook/mock 无签名 → 400", async ({ request }) => {
    const resp = await request.post("/api/payments/webhook/mock", {
      data: { orderNo: "20000101010101deadbeef", amountCents: 100, transactionId: "x" },
    });
    expect(resp.status()).toBe(400);
  });

  test("POST /api/payments/webhook/unknown → 404", async ({ request }) => {
    const resp = await request.post("/api/payments/webhook/unknown", {
      data: {},
    });
    expect(resp.status()).toBe(404);
  });

  test("webhook 流转订单到 PAID + 幂等", async ({ page, request }) => {
    await loginAs(page, ADMIN_EMAIL);
    const cookie = await sessionCookie(page);

    // 1. 下单
    const create = await request.post("/api/orders", {
      headers: { cookie },
      data: {
        type: "MEMBERSHIP",
        planSlug: "pro-monthly",
        paymentMethod: "WECHAT_PAY",
      },
    });
    expect(create.status()).toBe(201);
    const { data: order } = await create.json();
    const transactionId = `mock_${order.orderNo}`;
    const paidAt = new Date().toISOString();
    const sig = signMock({
      orderNo: order.orderNo,
      amountCents: order.amountCents,
      transactionId,
      paidAt,
    });

    // 2. webhook → PAID
    const callback = await request.post("/api/payments/webhook/mock", {
      headers: { "x-mock-signature": sig },
      data: {
        orderNo: order.orderNo,
        amountCents: order.amountCents,
        transactionId,
        paidAt,
      },
    });
    expect(callback.status()).toBe(200);

    // 3. 校验落 PAID
    const detail = await request.get(`/api/orders/${order.orderNo}`, {
      headers: { cookie },
    });
    expect(detail.status()).toBe(200);
    const json = await detail.json();
    expect(json.data.status).toBe("PAID");
    expect(typeof json.data.paidAt).toBe("string");

    // 4. 幂等：重复 webhook 不出错且仍 PAID
    const replay = await request.post("/api/payments/webhook/mock", {
      headers: { "x-mock-signature": sig },
      data: {
        orderNo: order.orderNo,
        amountCents: order.amountCents,
        transactionId,
        paidAt,
      },
    });
    expect(replay.status()).toBe(200);
    const after = await request.get(`/api/orders/${order.orderNo}`, {
      headers: { cookie },
    });
    const afterJson = await after.json();
    expect(afterJson.data.status).toBe("PAID");
  });

  test("webhook 金额不一致 → 400 + 订单仍 PENDING", async ({
    page,
    request,
  }) => {
    await loginAs(page, ADMIN_EMAIL);
    const cookie = await sessionCookie(page);
    const create = await request.post("/api/orders", {
      headers: { cookie },
      data: {
        type: "MEMBERSHIP",
        planSlug: "pro-monthly",
        paymentMethod: "WECHAT_PAY",
      },
    });
    const { data: order } = await create.json();
    const wrongAmount = order.amountCents + 1;
    const paidAt = new Date().toISOString();
    const sig = signMock({
      orderNo: order.orderNo,
      amountCents: wrongAmount,
      transactionId: `mock_${order.orderNo}`,
      paidAt,
    });
    const resp = await request.post("/api/payments/webhook/mock", {
      headers: { "x-mock-signature": sig },
      data: {
        orderNo: order.orderNo,
        amountCents: wrongAmount,
        transactionId: `mock_${order.orderNo}`,
        paidAt,
      },
    });
    expect(resp.status()).toBe(400);
    const after = await request.get(`/api/orders/${order.orderNo}`, {
      headers: { cookie },
    });
    const json = await after.json();
    expect(json.data.status).toBe("PENDING");
  });

  test("webhook 改写 paidAt 后签名失效 → 400", async ({ page, request }) => {
    await loginAs(page, ADMIN_EMAIL);
    const cookie = await sessionCookie(page);
    const create = await request.post("/api/orders", {
      headers: { cookie },
      data: {
        type: "MEMBERSHIP",
        planSlug: "pro-monthly",
        paymentMethod: "WECHAT_PAY",
      },
    });
    const { data: order } = await create.json();
    const transactionId = `mock_${order.orderNo}`;
    const paidAt = new Date().toISOString();
    const sig = signMock({
      orderNo: order.orderNo,
      amountCents: order.amountCents,
      transactionId,
      paidAt,
    });
    // 攻击者改写 paidAt（不重新签名）→ 验签应失败
    const resp = await request.post("/api/payments/webhook/mock", {
      headers: { "x-mock-signature": sig },
      data: {
        orderNo: order.orderNo,
        amountCents: order.amountCents,
        transactionId,
        paidAt: new Date(Date.now() + 24 * 3600_000).toISOString(),
      },
    });
    expect(resp.status()).toBe(400);
  });

  test("/checkout/<orderNo> 登录后渲染收银台", async ({ page, request }) => {
    await loginAs(page, ADMIN_EMAIL);
    const cookie = await sessionCookie(page);
    const create = await request.post("/api/orders", {
      headers: { cookie },
      data: {
        type: "MEMBERSHIP",
        planSlug: "pro-monthly",
        paymentMethod: "WECHAT_PAY",
      },
    });
    const { data: order } = await create.json();
    const resp = await page.goto(`/checkout/${order.orderNo}?provider=mock`, {
      waitUntil: "domcontentloaded",
    });
    expect(resp?.status() ?? 500).toBeLessThan(400);
    await expect(
      page.getByRole("heading", { name: /收银|订单|确认/, level: 1 }),
    ).toBeVisible();
    await expect(page.locator("body")).toContainText(order.orderNo);
    await expect(
      page.getByRole("button", { name: /我已完成支付|开发模拟/ }),
    ).toBeVisible();
  });

  test("/pricing 登录后渲染支付方式选择 + 立即购买按钮", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL);
    await page.goto("/pricing", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("button", { name: /开通|立即购买|开通 Pro/ }).first(),
    ).toBeVisible();
    await expect(page.getByText(/微信支付/).first()).toBeVisible();
    await expect(page.getByText(/支付宝/).first()).toBeVisible();
  });
});
