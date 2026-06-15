import { createHmac } from "node:crypto";

import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { loginAs } from "./helpers/auth";

/**
 * Stage 16.3 验收：退款行级锁 + 系统通知去重。
 *
 *  Run: npx playwright test stage16-3-refund-race
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

async function createPaidOrder(
  page: Page,
  request: APIRequestContext,
): Promise<{ orderNo: string; amountCents: number }> {
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
    data: { orderNo: string; amountCents: number };
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

test.describe("Stage 16.3 · refund FOR UPDATE + system notif dedup", () => {
  test("并发两次全额退款 → 仅一次成功，不会双退", async ({ page, request }) => {
    // 1. 客户下单 + PAID
    await loginAs(page, CLIENT_EMAIL);
    const order = await createPaidOrder(page, request);

    // 2. admin 并发发起两次全额退款
    const adminPage = await page.context().newPage();
    await loginAs(adminPage, ADMIN_EMAIL);
    const adminCookie = await sessionCookie(adminPage);

    const [resA, resB] = await Promise.all([
      request.post(`/api/admin/orders/${order.orderNo}/refund`, {
        headers: { cookie: adminCookie },
        data: {},
      }),
      request.post(`/api/admin/orders/${order.orderNo}/refund`, {
        headers: { cookie: adminCookie },
        data: {},
      }),
    ]);

    // 一个 200 / 一个 400（超额）；具体哪个赢取决于 FOR UPDATE 调度。
    const statuses = [resA.status(), resB.status()].sort();
    expect(statuses).toEqual([200, 400]);

    // 3. 订单状态应为 REFUNDED，refundCents = amountCents（仅退一次）
    const detail = await request.get(`/api/admin/orders/${order.orderNo}`, {
      headers: { cookie: adminCookie },
    });
    expect(detail.status()).toBe(200);
    const { data } = (await detail.json()) as {
      data: { status: string; refundCents: number; amountCents: number };
    };
    expect(data.status).toBe("REFUNDED");
    expect(data.refundCents).toBe(order.amountCents);
  });

  test("两次部分退款（各半额）→ 双方都成功，总额吻合", async ({ page, request }) => {
    // 顺序退一半、再退一半（非并发）—— 不应被锁误伤。
    await loginAs(page, CLIENT_EMAIL);
    const order = await createPaidOrder(page, request);

    const adminPage = await page.context().newPage();
    await loginAs(adminPage, ADMIN_EMAIL);
    const adminCookie = await sessionCookie(adminPage);

    const half = Math.floor(order.amountCents / 2);

    const a = await request.post(`/api/admin/orders/${order.orderNo}/refund`, {
      headers: { cookie: adminCookie },
      data: { amountCents: half },
    });
    expect(a.status()).toBe(200);

    const b = await request.post(`/api/admin/orders/${order.orderNo}/refund`, {
      headers: { cookie: adminCookie },
      data: { amountCents: order.amountCents - half },
    });
    expect(b.status()).toBe(200);

    const detail = await request.get(`/api/admin/orders/${order.orderNo}`, {
      headers: { cookie: adminCookie },
    });
    const { data } = (await detail.json()) as {
      data: { status: string; refundCents: number };
    };
    expect(data.status).toBe("REFUNDED");
    expect(data.refundCents).toBe(order.amountCents);
  });

  test("退款流程整合：一次退款产生且仅产生一条 ORDER_REFUNDED 通知", async ({
    page,
    request,
  }) => {
    // SYSTEM_DEDUP_TYPES 的真正去重单元测在 lib 层；这里做集成 sanity：
    // 一次完整退款链路落 1 条通知（不会因为 refundOrder 内部某段被重入导致多发）。
    await loginAs(page, CLIENT_EMAIL);
    const clientCookie = await sessionCookie(page);
    const order = await createPaidOrder(page, request);

    const adminPage = await page.context().newPage();
    await loginAs(adminPage, ADMIN_EMAIL);
    const adminCookie = await sessionCookie(adminPage);

    const refund = await request.post(
      `/api/admin/orders/${order.orderNo}/refund`,
      { headers: { cookie: adminCookie }, data: {} },
    );
    expect(refund.status()).toBe(200);

    const notifs = await request.get("/api/notifications", {
      headers: { cookie: clientCookie },
    });
    expect(notifs.status()).toBe(200);
    const { data } = (await notifs.json()) as {
      data: {
        notifications: Array<{
          type: string;
          targetType: string | null;
          targetId: string | null;
        }>;
      };
    };
    const refundedFor = data.notifications.filter(
      (n) =>
        n.type === "ORDER_REFUNDED" &&
        n.targetType === "ORDER" &&
        n.targetId === order.orderNo,
    );
    expect(refundedFor.length).toBe(1);
  });
});
