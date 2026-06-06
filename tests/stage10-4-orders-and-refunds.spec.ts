import { createHmac } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { loginAs } from "./helpers/auth";

/**
 * Stage 10.4 验收 —— /me/orders + /admin/orders + refund flow。
 *
 *  Run: npx playwright test stage10-4
 */

const ADMIN_EMAIL = "admin@aivideohub.com";
const CLIENT_EMAIL = "client@aivideohub.com";
const MOCK_SECRET =
  process.env.PAYMENT_MOCK_SECRET || "seedland-dev-mock-secret";

function signMock(p: {
  orderNo: string;
  amountCents: number;
  transactionId: string;
  paidAt: string;
}): string {
  const canonical = `orderNo=${p.orderNo}&amountCents=${p.amountCents}&transactionId=${p.transactionId}&paidAt=${p.paidAt}`;
  return createHmac("sha256", MOCK_SECRET).update(canonical).digest("hex");
}

async function sessionCookie(page: Page) {
  const cookies = await page.context().cookies();
  const sess = cookies.find((c) => c.name === "seedland_session");
  if (!sess) throw new Error("session cookie missing");
  return `${sess.name}=${sess.value}`;
}

interface CreatedOrder {
  orderNo: string;
  amountCents: number;
  currency: string;
}

async function createPaidOrder(
  page: Page,
  request: import("@playwright/test").APIRequestContext,
): Promise<CreatedOrder> {
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
  const { data: order } = (await create.json()) as {
    data: CreatedOrder;
  };
  const transactionId = `mock_${order.orderNo}`;
  const paidAt = new Date().toISOString();
  const sig = signMock({
    orderNo: order.orderNo,
    amountCents: order.amountCents,
    transactionId,
    paidAt,
  });
  const cb = await request.post("/api/payments/webhook/mock", {
    headers: { "x-mock-signature": sig },
    data: {
      orderNo: order.orderNo,
      amountCents: order.amountCents,
      transactionId,
      paidAt,
    },
  });
  expect(cb.status()).toBe(200);
  return order;
}

test.describe("Stage 10.4 · /me/orders + /admin/orders + refunds", () => {
  // ─────────────────────── RBAC + page renders ───────────────────────

  test("/me/orders 匿名 → /auth/login (next 携带)", async ({ page }) => {
    await page.goto("/me/orders", { waitUntil: "domcontentloaded" });
    expect(page.url()).toMatch(/\/auth\/login/);
    expect(decodeURIComponent(page.url())).toContain("next=/me/orders");
  });

  test("/me/orders 登录后 200 + 渲染 H1", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL);
    const resp = await page.goto("/me/orders", { waitUntil: "domcontentloaded" });
    expect(resp?.status() ?? 500).toBeLessThan(400);
    await expect(
      page.getByRole("heading", { name: /历史订单与退款/, level: 1 }),
    ).toBeVisible();
  });

  test("/admin/orders 非 admin → 跳首页 (reason=admin-only)", async ({
    page,
  }) => {
    await loginAs(page, CLIENT_EMAIL);
    await page.goto("/admin/orders", { waitUntil: "domcontentloaded" });
    expect(page.url()).toMatch(/\/\?reason=admin-only/);
  });

  test("/admin/orders admin 200 + 渲染筛选栏", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL);
    const resp = await page.goto("/admin/orders", {
      waitUntil: "domcontentloaded",
    });
    expect(resp?.status() ?? 500).toBeLessThan(400);
    await expect(
      page.getByRole("heading", { name: /订单管理/, level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /筛选/ })).toBeVisible();
  });

  // ─────────────────────── API guards ───────────────────────

  test("GET /api/me/orders 匿名 → 401", async ({ request }) => {
    const resp = await request.get("/api/me/orders");
    expect(resp.status()).toBe(401);
  });

  test("GET /api/me/orders 登录 → 200 + 分页结构", async ({
    page,
    request,
  }) => {
    await loginAs(page, ADMIN_EMAIL);
    const cookie = await sessionCookie(page);
    const resp = await request.get("/api/me/orders?pageSize=5", {
      headers: { cookie },
    });
    expect(resp.status()).toBe(200);
    const json = await resp.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data.items)).toBe(true);
    expect(typeof json.data.total).toBe("number");
    expect(typeof json.data.page).toBe("number");
  });

  test("GET /api/admin/orders 非 admin → 403", async ({ page, request }) => {
    await loginAs(page, CLIENT_EMAIL);
    const cookie = await sessionCookie(page);
    const resp = await request.get("/api/admin/orders", {
      headers: { cookie },
    });
    expect(resp.status()).toBe(403);
  });

  test("GET /api/admin/orders 匿名 → 401", async ({ request }) => {
    const resp = await request.get("/api/admin/orders");
    expect(resp.status()).toBe(401);
  });

  test("GET /api/admin/orders admin → 200 + 接受筛选", async ({
    page,
    request,
  }) => {
    await loginAs(page, ADMIN_EMAIL);
    const cookie = await sessionCookie(page);
    const resp = await request.get(
      "/api/admin/orders?status=PAID&type=MEMBERSHIP&page=1",
      { headers: { cookie } },
    );
    expect(resp.status()).toBe(200);
  });

  test("POST /api/admin/orders/<bad-format>/refund → 404", async ({
    page,
    request,
  }) => {
    await loginAs(page, ADMIN_EMAIL);
    const cookie = await sessionCookie(page);
    const resp = await request.post(
      "/api/admin/orders/zzz-bad-format/refund",
      { headers: { cookie }, data: {} },
    );
    expect(resp.status()).toBe(404);
  });

  test("POST /api/admin/orders/<orderNo>/refund 匿名 → 401", async ({
    request,
  }) => {
    const resp = await request.post(
      "/api/admin/orders/20000101010101deadbeef/refund",
      { data: {} },
    );
    expect(resp.status()).toBe(401);
  });

  test("POST /api/admin/orders/<orderNo>/refund 非 admin → 403", async ({
    page,
    request,
  }) => {
    await loginAs(page, CLIENT_EMAIL);
    const cookie = await sessionCookie(page);
    const resp = await request.post(
      "/api/admin/orders/20000101010101deadbeef/refund",
      { headers: { cookie }, data: {} },
    );
    expect(resp.status()).toBe(403);
  });

  // ─────────────────────── refund flow (full) ───────────────────────

  test("PAID 订单全额退款 → 200 + 状态 REFUNDED + 通知", async ({
    page,
    request,
  }) => {
    await loginAs(page, ADMIN_EMAIL);
    const cookie = await sessionCookie(page);
    const order = await createPaidOrder(page, request);

    const refund = await request.post(
      `/api/admin/orders/${order.orderNo}/refund`,
      {
        headers: { cookie },
        data: { reason: "stage10.4 自动化测试" },
      },
    );
    expect(refund.status()).toBe(200);
    const json = await refund.json();
    expect(json.success).toBe(true);
    expect(json.data.fullyRefunded).toBe(true);
    expect(json.data.amountCents).toBe(order.amountCents);
    expect(json.data.refundCentsTotal).toBe(order.amountCents);

    // 订单状态变 REFUNDED
    const detail = await request.get(`/api/orders/${order.orderNo}`, {
      headers: { cookie },
    });
    expect(detail.status()).toBe(200);
    const detailJson = await detail.json();
    expect(detailJson.data.status).toBe("REFUNDED");

    // /me/orders 列表应能筛选到这单
    const list = await request.get(
      "/api/me/orders?status=REFUNDED&pageSize=50",
      { headers: { cookie } },
    );
    expect(list.status()).toBe(200);
    const listJson = await list.json();
    const found = listJson.data.items.find(
      (o: { orderNo: string }) => o.orderNo === order.orderNo,
    );
    expect(found).toBeTruthy();
    expect(found.status).toBe("REFUNDED");
    expect(found.refundCents).toBe(order.amountCents);
  });

  // ─────────────────────── refund flow (partial + accumulate) ────

  test("PAID 订单部分退款累加；超出可退余额 → 400", async ({
    page,
    request,
  }) => {
    await loginAs(page, ADMIN_EMAIL);
    const cookie = await sessionCookie(page);
    const order = await createPaidOrder(page, request);

    const first = await request.post(
      `/api/admin/orders/${order.orderNo}/refund`,
      {
        headers: { cookie },
        data: { amountCents: 100, reason: "首次部分退款" },
      },
    );
    expect(first.status()).toBe(200);
    const firstJson = await first.json();
    expect(firstJson.data.fullyRefunded).toBe(false);
    expect(firstJson.data.amountCents).toBe(100);

    // 再退一次 — 仍属部分
    const second = await request.post(
      `/api/admin/orders/${order.orderNo}/refund`,
      { headers: { cookie }, data: { amountCents: 50 } },
    );
    expect(second.status()).toBe(200);
    const secondJson = await second.json();
    expect(secondJson.data.refundCentsTotal).toBe(150);

    // 超额退款 → 400
    const over = await request.post(
      `/api/admin/orders/${order.orderNo}/refund`,
      { headers: { cookie }, data: { amountCents: order.amountCents } },
    );
    expect(over.status()).toBe(400);

    // 订单仍 PAID（refundCents 累计 150）
    const detail = await request.get(`/api/orders/${order.orderNo}`, {
      headers: { cookie },
    });
    const detailJson = await detail.json();
    expect(detailJson.data.status).toBe("PAID");
  });

  // ─────────────────────── refund flow (already-refunded) ────────

  test("REFUNDED 订单再次退款 → 400", async ({ page, request }) => {
    await loginAs(page, ADMIN_EMAIL);
    const cookie = await sessionCookie(page);
    const order = await createPaidOrder(page, request);

    // 全额一次性退
    const r1 = await request.post(
      `/api/admin/orders/${order.orderNo}/refund`,
      { headers: { cookie }, data: {} },
    );
    expect(r1.status()).toBe(200);

    // 再退 → 应 400（订单当前状态不是 PAID）
    const r2 = await request.post(
      `/api/admin/orders/${order.orderNo}/refund`,
      { headers: { cookie }, data: { amountCents: 1 } },
    );
    expect(r2.status()).toBe(400);
  });

  // ─────────────────────── refund input validation ───────────────

  test("退款金额 ≤ 0 → 400", async ({ page, request }) => {
    await loginAs(page, ADMIN_EMAIL);
    const cookie = await sessionCookie(page);
    const order = await createPaidOrder(page, request);
    const resp = await request.post(
      `/api/admin/orders/${order.orderNo}/refund`,
      { headers: { cookie }, data: { amountCents: 0 } },
    );
    expect(resp.status()).toBe(400);
  });
});
