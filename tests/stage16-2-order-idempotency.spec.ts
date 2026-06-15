import { expect, test } from "@playwright/test";

import { loginAs } from "./helpers/auth";

/**
 * Stage 16.2 验收：Order.clientNonce 防双击 / 网络重试创建重复订单。
 *
 *  Run: npx playwright test stage16-2-order-idempotency
 */

const ADMIN_EMAIL = "admin@aivideohub.com";

async function sessionCookie(page: import("@playwright/test").Page) {
  const cookies = await page.context().cookies();
  const sess = cookies.find((c) => c.name === "seedland_session");
  if (!sess) throw new Error("session cookie missing");
  return `${sess.name}=${sess.value}`;
}

function freshNonce(): string {
  return `n_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 12)
    .padEnd(10, "0")}`;
}

test.describe("Stage 16.2 · Order clientNonce 幂等", () => {
  test("同 nonce 两次 POST → 返回同一 orderNo", async ({ page, request }) => {
    await loginAs(page, ADMIN_EMAIL);
    const cookie = await sessionCookie(page);
    const nonce = freshNonce();

    const first = await request.post("/api/orders", {
      headers: { cookie },
      data: {
        type: "MEMBERSHIP",
        planSlug: "pro-monthly",
        paymentMethod: "WECHAT_PAY",
        clientNonce: nonce,
      },
    });
    expect(first.status()).toBe(201);
    const firstJson = (await first.json()) as {
      data: { orderNo: string; paymentUrl: string };
    };

    const second = await request.post("/api/orders", {
      headers: { cookie },
      data: {
        type: "MEMBERSHIP",
        planSlug: "pro-monthly",
        paymentMethod: "WECHAT_PAY",
        clientNonce: nonce,
      },
    });
    expect(second.status()).toBe(201);
    const secondJson = (await second.json()) as {
      data: { orderNo: string; paymentUrl: string };
    };

    expect(secondJson.data.orderNo).toBe(firstJson.data.orderNo);
    expect(secondJson.data.paymentUrl).toBe(firstJson.data.paymentUrl);
  });

  test("不同 nonce → 两笔独立订单", async ({ page, request }) => {
    await loginAs(page, ADMIN_EMAIL);
    const cookie = await sessionCookie(page);

    const a = await request.post("/api/orders", {
      headers: { cookie },
      data: {
        type: "MEMBERSHIP",
        planSlug: "pro-monthly",
        paymentMethod: "WECHAT_PAY",
        clientNonce: freshNonce(),
      },
    });
    const aJson = (await a.json()) as { data: { orderNo: string } };

    const b = await request.post("/api/orders", {
      headers: { cookie },
      data: {
        type: "MEMBERSHIP",
        planSlug: "pro-monthly",
        paymentMethod: "WECHAT_PAY",
        clientNonce: freshNonce(),
      },
    });
    const bJson = (await b.json()) as { data: { orderNo: string } };

    expect(aJson.data.orderNo).not.toBe(bJson.data.orderNo);
  });

  test("无 nonce 路径仍按旧行为允许重复", async ({ page, request }) => {
    // 兼容旧调用方：不带 nonce 时降级为非幂等的允许两单。
    await loginAs(page, ADMIN_EMAIL);
    const cookie = await sessionCookie(page);

    const a = await request.post("/api/orders", {
      headers: { cookie },
      data: {
        type: "MEMBERSHIP",
        planSlug: "pro-monthly",
        paymentMethod: "WECHAT_PAY",
      },
    });
    const aJson = (await a.json()) as { data: { orderNo: string } };

    const b = await request.post("/api/orders", {
      headers: { cookie },
      data: {
        type: "MEMBERSHIP",
        planSlug: "pro-monthly",
        paymentMethod: "WECHAT_PAY",
      },
    });
    const bJson = (await b.json()) as { data: { orderNo: string } };

    expect(aJson.data.orderNo).not.toBe(bJson.data.orderNo);
  });

  test("非法 nonce 字符 → 400", async ({ page, request }) => {
    await loginAs(page, ADMIN_EMAIL);
    const cookie = await sessionCookie(page);

    const resp = await request.post("/api/orders", {
      headers: { cookie },
      data: {
        type: "MEMBERSHIP",
        planSlug: "pro-monthly",
        paymentMethod: "WECHAT_PAY",
        clientNonce: "has@illegal/chars!!", // schema 拒绝非 [A-Za-z0-9_-]
      },
    });
    expect(resp.status()).toBe(400);
  });
});
