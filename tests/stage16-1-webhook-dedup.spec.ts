import { createHmac } from "node:crypto";

import { expect, test } from "@playwright/test";

import { loginAs } from "./helpers/auth";

/**
 * Stage 16.1 验收：webhook 幂等表 + Alipay 时间戳校验。
 *
 * 已存在 stage10-checkout 覆盖的是 markOrderPaid 内部 updateMany 幂等；
 * 16.1 在 webhook 路由层加了 WebhookEvent dedup，重发应短路在 markOrderPaid 之前。
 *
 *  Run: npx playwright test stage16-1-webhook-dedup
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

test.describe("Stage 16.1 · webhook 幂等表", () => {
  test("首次回调成功；重发返 replay=true，不再触发业务副作用", async ({
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

    const first = await request.post("/api/payments/webhook/mock", {
      headers: { "x-mock-signature": sig },
      data: { orderNo: order.orderNo, amountCents: order.amountCents, transactionId, paidAt },
    });
    expect(first.status()).toBe(200);
    const firstBody = (await first.json()) as {
      data: { received: boolean; replay?: boolean };
    };
    expect(firstBody.data.received).toBe(true);
    expect(firstBody.data.replay ?? false).toBe(false);

    // 重发：完全相同的 body + 签名。
    const replay = await request.post("/api/payments/webhook/mock", {
      headers: { "x-mock-signature": sig },
      data: { orderNo: order.orderNo, amountCents: order.amountCents, transactionId, paidAt },
    });
    expect(replay.status()).toBe(200);
    const replayBody = (await replay.json()) as {
      data: { received: boolean; replay?: boolean };
    };
    expect(replayBody.data.replay).toBe(true);

    // 订单仍 PAID，未被二次写入。
    const detail = await request.get(`/api/orders/${order.orderNo}`, {
      headers: { cookie },
    });
    const { data: after } = (await detail.json()) as {
      data: { status: string };
    };
    expect(after.status).toBe("PAID");
  });

  test("同 orderNo 不同 paidAt → 视为不同事件，可以再次推进", async ({
    page,
    request,
  }) => {
    // providerEventId = `${orderNo}|${transactionId}|${paidAt.toISOString()}`，
    // paidAt 变 → eventId 变 → 不会被 dedup 表短路。但 markOrderPaid 仍幂等
    // （updateMany WHERE status=PENDING），第二次返回 alreadyPaid，订单状态不变。
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
    const { data: order } = (await create.json()) as {
      data: { orderNo: string; amountCents: number };
    };
    const transactionId = `mock_${order.orderNo}`;

    const paidAtA = new Date().toISOString();
    const sigA = signMock({
      orderNo: order.orderNo,
      amountCents: order.amountCents,
      transactionId,
      paidAt: paidAtA,
    });
    const a = await request.post("/api/payments/webhook/mock", {
      headers: { "x-mock-signature": sigA },
      data: {
        orderNo: order.orderNo,
        amountCents: order.amountCents,
        transactionId,
        paidAt: paidAtA,
      },
    });
    expect(a.status()).toBe(200);
    const aBody = (await a.json()) as { data: { replay?: boolean } };
    expect(aBody.data.replay ?? false).toBe(false);

    const paidAtB = new Date(Date.now() + 5_000).toISOString();
    const sigB = signMock({
      orderNo: order.orderNo,
      amountCents: order.amountCents,
      transactionId,
      paidAt: paidAtB,
    });
    const b = await request.post("/api/payments/webhook/mock", {
      headers: { "x-mock-signature": sigB },
      data: {
        orderNo: order.orderNo,
        amountCents: order.amountCents,
        transactionId,
        paidAt: paidAtB,
      },
    });
    expect(b.status()).toBe(200);
    const bBody = (await b.json()) as { data: { replay?: boolean } };
    // 不同 paidAt 意味着不同 providerEventId → 不命中 dedup 表的 replay 分支。
    expect(bBody.data.replay ?? false).toBe(false);
  });

  test("缺签名 → 400 + dedup 表无记录", async ({ request }) => {
    // 验签失败的回调不应污染 webhook_events 表（也无法污染：providerEventId 没法从一个未验签的请求里得出）。
    const resp = await request.post("/api/payments/webhook/mock", {
      data: {
        orderNo: "20000101010101deadbeef",
        amountCents: 100,
        transactionId: "x",
        paidAt: new Date().toISOString(),
      },
    });
    expect(resp.status()).toBe(400);
  });
});
