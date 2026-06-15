import { createHmac } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { loginAs } from "./helpers/auth";

/**
 * Stage 16.5 验收 —— 付费下载签名 URL。
 *
 * 关键不变量：
 *   1. 客户端拿不到裸 download_url；只能通过 POST /api/orders/.../download-url 拿到 5min HMAC token。
 *   2. GET /api/orders/.../download?t=... 在「过期 / 篡改 / 非本人 / 已退款」时不会 302，会返回 4xx。
 *   3. 成功 redeem 时返回 302，Location = 卖家裸 URL，Referrer-Policy: no-referrer。
 *   4. 单 token 可以重复 redeem（直到过期）— 不做单次性，避免误点 / 移动端预加载导致 token 浪费。
 *   5. /me/orders 与 /checkout HTML 中**绝不**直接包含卖家裸 URL。
 *
 *  Run: npx playwright test stage16-5-download-signed-urls
 */

const ADMIN_EMAIL = "admin@aivideohub.com";
const CLIENT_EMAIL = "client@aivideohub.com";
const CREATOR_EMAIL = "creator@aivideohub.com";
const MOCK_SECRET =
  process.env.PAYMENT_MOCK_SECRET || "seedland-dev-mock-secret";

const SELLER_DOWNLOAD_URL = `https://example.com/dl/stage16-5-${Date.now()}.zip`;

function signMock(p: {
  orderNo: string;
  amountCents: number;
  transactionId: string;
  paidAt: string;
}): string {
  const canonical = `orderNo=${p.orderNo}&amountCents=${p.amountCents}&transactionId=${p.transactionId}&paidAt=${p.paidAt}`;
  return createHmac("sha256", MOCK_SECRET).update(canonical).digest("hex");
}

async function sessionCookie(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  const sess = cookies.find((c) => c.name === "seedland_session");
  if (!sess) throw new Error("session cookie missing");
  return `${sess.name}=${sess.value}`;
}

async function publishWorkflowItem(
  request: import("@playwright/test").APIRequestContext,
  creatorCookie: string,
  downloadUrl: string,
): Promise<string> {
  const createItem = await request.post("/api/me/workflow-items", {
    headers: { cookie: creatorCookie },
    data: {
      title: `Stage 16.5 测试商品 ${Date.now()}`,
      description: "stage 16.5 自动化测试用工作流商品。",
      priceCents: 1999,
      category: "COMFYUI_WORKFLOW",
      downloadUrl,
    },
  });
  expect(createItem.status()).toBe(201);
  const { data } = await createItem.json();
  const itemId = data.id as string;
  const pub = await request.patch(`/api/me/workflow-items/${itemId}`, {
    headers: { cookie: creatorCookie },
    data: { status: "PUBLISHED" },
  });
  expect(pub.status()).toBe(200);
  return itemId;
}

interface PaidWorkflowOrder {
  orderNo: string;
  amountCents: number;
  buyerCookie: string;
  itemId: string;
}

async function createPaidWorkflowOrder(args: {
  browser: import("@playwright/test").Browser;
  request: import("@playwright/test").APIRequestContext;
  /** 哪个买家邮箱；默认 ADMIN（避免和 creator 同账号触发 "不能购买自己商品"） */
  buyerEmail?: string;
}): Promise<PaidWorkflowOrder> {
  const buyerEmail = args.buyerEmail ?? ADMIN_EMAIL;

  // 1) creator 上架商品
  const creatorCtx = await args.browser.newContext();
  const creatorPage = await creatorCtx.newPage();
  await loginAs(creatorPage, CREATOR_EMAIL);
  const creatorCookie = await sessionCookie(creatorPage);
  const itemId = await publishWorkflowItem(
    args.request,
    creatorCookie,
    SELLER_DOWNLOAD_URL,
  );
  await creatorCtx.close();

  // 2) buyer 下单 + mock pay
  const buyerCtx = await args.browser.newContext();
  const buyerPage = await buyerCtx.newPage();
  await loginAs(buyerPage, buyerEmail);
  const buyerCookie = await sessionCookie(buyerPage);

  const create = await args.request.post("/api/orders", {
    headers: { cookie: buyerCookie },
    data: {
      type: "WORKFLOW_PURCHASE",
      workflowItemId: itemId,
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
  const cb = await args.request.post("/api/payments/webhook/mock", {
    headers: { "x-mock-signature": sig },
    data: {
      orderNo: order.orderNo,
      amountCents: order.amountCents,
      transactionId,
      paidAt,
    },
  });
  expect(cb.status()).toBe(200);

  await buyerCtx.close();

  return {
    orderNo: order.orderNo,
    amountCents: order.amountCents,
    buyerCookie,
    itemId,
  };
}

// 多次 loginAs + 跨上下文操作；30s 默认超时太紧，给到 90s。
test.describe.configure({ timeout: 90_000 });

test.describe("Stage 16.5 · 付费下载签名 URL", () => {
  // ─────────────── 鉴权 / 状态机 ───────────────

  test("POST /api/orders/<orderNo>/download-url 匿名 → 401", async ({
    request,
  }) => {
    const resp = await request.post(
      "/api/orders/20000101010101deadbeef/download-url",
    );
    expect(resp.status()).toBe(401);
  });

  test("POST /api/orders/<bad-format>/download-url → 404", async ({
    page,
    request,
  }) => {
    await loginAs(page, ADMIN_EMAIL);
    const cookie = await sessionCookie(page);
    const resp = await request.post(
      "/api/orders/zzz-bad/download-url",
      { headers: { cookie } },
    );
    expect(resp.status()).toBe(404);
  });

  test("POST /api/orders/<orderNo>/download-url 非本人 → 404 (不暴露存在)", async ({
    browser,
    request,
  }) => {
    const paid = await createPaidWorkflowOrder({ browser, request });

    // 用另一个账号去尝试 mint
    const otherCtx = await browser.newContext();
    const otherPage = await otherCtx.newPage();
    await loginAs(otherPage, CLIENT_EMAIL);
    const otherCookie = await sessionCookie(otherPage);
    const resp = await request.post(
      `/api/orders/${paid.orderNo}/download-url`,
      { headers: { cookie: otherCookie } },
    );
    expect(resp.status()).toBe(404);
    await otherCtx.close();
  });

  test("PENDING 订单尝试 mint → 403", async ({ browser, request }) => {
    // creator 上架 → admin 下单但**不**模拟支付
    const creatorCtx = await browser.newContext();
    const creatorPage = await creatorCtx.newPage();
    await loginAs(creatorPage, CREATOR_EMAIL);
    const creatorCookie = await sessionCookie(creatorPage);
    const itemId = await publishWorkflowItem(
      request,
      creatorCookie,
      SELLER_DOWNLOAD_URL,
    );
    await creatorCtx.close();

    const buyerCtx = await browser.newContext();
    const buyerPage = await buyerCtx.newPage();
    await loginAs(buyerPage, ADMIN_EMAIL);
    const buyerCookie = await sessionCookie(buyerPage);
    const create = await request.post("/api/orders", {
      headers: { cookie: buyerCookie },
      data: {
        type: "WORKFLOW_PURCHASE",
        workflowItemId: itemId,
        paymentMethod: "WECHAT_PAY",
      },
    });
    const { data: order } = await create.json();
    const resp = await request.post(
      `/api/orders/${order.orderNo}/download-url`,
      { headers: { cookie: buyerCookie } },
    );
    expect(resp.status()).toBe(403);
    await buyerCtx.close();
  });

  // ─────────────── 完整成功流 ───────────────

  test("PAID 订单 mint → GET 兑换 302 到卖家裸 URL + Referrer-Policy", async ({
    browser,
    request,
  }) => {
    const paid = await createPaidWorkflowOrder({ browser, request });
    const mint = await request.post(
      `/api/orders/${paid.orderNo}/download-url`,
      { headers: { cookie: paid.buyerCookie } },
    );
    expect(mint.status()).toBe(200);
    const mintJson = await mint.json();
    expect(mintJson.success).toBe(true);
    expect(typeof mintJson.data.url).toBe("string");
    expect(typeof mintJson.data.expiresAt).toBe("string");
    const url: string = mintJson.data.url;
    expect(url).toContain(`/api/orders/${paid.orderNo}/download?t=`);

    // 不跟随 redirect 才能拿到 Location 头
    const redeem = await request.get(url, {
      maxRedirects: 0,
      headers: { cookie: paid.buyerCookie },
    });
    expect(redeem.status()).toBe(302);
    expect(redeem.headers()["location"]).toBe(SELLER_DOWNLOAD_URL);
    expect(redeem.headers()["referrer-policy"]).toBe("no-referrer");
    // 防中间缓存：Cache-Control: no-store
    expect(redeem.headers()["cache-control"]).toContain("no-store");
  });

  test("同 token 可多次 redeem（直到过期）", async ({ browser, request }) => {
    const paid = await createPaidWorkflowOrder({ browser, request });
    const mint = await request.post(
      `/api/orders/${paid.orderNo}/download-url`,
      { headers: { cookie: paid.buyerCookie } },
    );
    const mintJson = await mint.json();
    const url: string = mintJson.data.url;

    for (let i = 0; i < 3; i++) {
      const r = await request.get(url, { maxRedirects: 0 });
      expect(r.status()).toBe(302);
    }
  });

  test("GET /download 不传 token → 401", async ({ browser, request }) => {
    const paid = await createPaidWorkflowOrder({ browser, request });
    const r = await request.get(
      `/api/orders/${paid.orderNo}/download`,
      { maxRedirects: 0 },
    );
    expect(r.status()).toBe(401);
  });

  test("GET /download 篡改签名 → 401", async ({ browser, request }) => {
    const paid = await createPaidWorkflowOrder({ browser, request });
    const mint = await request.post(
      `/api/orders/${paid.orderNo}/download-url`,
      { headers: { cookie: paid.buyerCookie } },
    );
    const url: string = (await mint.json()).data.url;
    // 把 token 的最后 4 个字符随便改一改，破坏签名
    const tampered = url.replace(/.{4}$/, "AAAA");
    const r = await request.get(tampered, { maxRedirects: 0 });
    expect(r.status()).toBe(401);
  });

  test("GET /download token orderNo 与 URL orderNo 不一致 → 401", async ({
    browser,
    request,
  }) => {
    // 用买家 A 的订单 mint 一个 token，然后挂到买家 B 的 order URL 上 redeem。
    // 我们没有第二个买家订单，所以人造一个仅 path 不同的请求即可。
    const paid = await createPaidWorkflowOrder({ browser, request });
    const mint = await request.post(
      `/api/orders/${paid.orderNo}/download-url`,
      { headers: { cookie: paid.buyerCookie } },
    );
    const url: string = (await mint.json()).data.url;
    const tParam = url.split("?t=")[1];
    // 构造另一个 orderNo 路径（合法格式即可）
    const swapped = `/api/orders/19990101010101cafebabe/download?t=${tParam}`;
    const r = await request.get(swapped, { maxRedirects: 0 });
    expect(r.status()).toBe(401);
  });

  // ─────────────── refund 撤销访问 ───────────────

  test("订单已退款 → mint 返回 403 + GET redeem 也返回 403（即便 token 仍未过期）", async ({
    browser,
    request,
  }) => {
    const paid = await createPaidWorkflowOrder({ browser, request });
    // 先 mint 一次，证明现在能 mint
    const ok = await request.post(
      `/api/orders/${paid.orderNo}/download-url`,
      { headers: { cookie: paid.buyerCookie } },
    );
    expect(ok.status()).toBe(200);
    const stillFreshUrl: string = (await ok.json()).data.url;

    // admin 全额退款
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await loginAs(adminPage, ADMIN_EMAIL);
    const adminCookie = await sessionCookie(adminPage);
    const refund = await request.post(
      `/api/admin/orders/${paid.orderNo}/refund`,
      {
        headers: { cookie: adminCookie },
        data: { reason: "stage 16.5 自动化测试退款" },
      },
    );
    expect(refund.status()).toBe(200);
    await adminCtx.close();

    // 已有 token 失效（业务层撤销，不是密码学层）
    const replay = await request.get(stillFreshUrl, { maxRedirects: 0 });
    expect(replay.status()).toBe(403);

    // 再次 mint 也被拒
    const remint = await request.post(
      `/api/orders/${paid.orderNo}/download-url`,
      { headers: { cookie: paid.buyerCookie } },
    );
    expect(remint.status()).toBe(403);
  });

  // ─────────────── HTML 不再泄漏裸 URL ───────────────

  // ─────────────── 审计 ───────────────

  test("成功 redeem 后 /admin/orders/<orderNo>/downloads 显示 grant 记录", async ({
    browser,
    request,
  }) => {
    const paid = await createPaidWorkflowOrder({ browser, request });

    // 触发一次成功的 redeem，确保有一行 grant
    const mint = await request.post(
      `/api/orders/${paid.orderNo}/download-url`,
      { headers: { cookie: paid.buyerCookie } },
    );
    const url: string = (await mint.json()).data.url;
    const redeem = await request.get(url, { maxRedirects: 0 });
    expect(redeem.status()).toBe(302);

    // admin 视图
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await loginAs(adminPage, ADMIN_EMAIL);
    const resp = await adminPage.goto(
      `/admin/orders/${paid.orderNo}/downloads`,
      { waitUntil: "domcontentloaded" },
    );
    expect(resp?.status() ?? 500).toBeLessThan(400);
    await expect(
      adminPage.getByRole("heading", { name: /下载兑换记录/, level: 1 }),
    ).toBeVisible();
    // 至少一行 grant：通过表格里出现 @username 来判定
    await expect(adminPage.locator("body")).toContainText("@admin");
    // **不能**泄漏卖家裸 URL（grant 视图刻意不展示 rawDownloadUrl）
    const html = await adminPage.content();
    expect(html).not.toContain(SELLER_DOWNLOAD_URL);
    await adminCtx.close();
  });

  test("非 admin 访问 /admin/orders/<orderNo>/downloads → 跳首页", async ({
    page,
  }) => {
    await loginAs(page, CLIENT_EMAIL);
    await page.goto("/admin/orders/20000101010101deadbeef/downloads", {
      waitUntil: "domcontentloaded",
    });
    expect(page.url()).toMatch(/\/\?reason=admin-only/);
  });

  // ─────────────── 协议白名单 ───────────────

  test("卖家上架 downloadUrl 必须是 http(s)；javascript: → 400", async ({
    browser,
    request,
  }) => {
    const creatorCtx = await browser.newContext();
    const creatorPage = await creatorCtx.newPage();
    await loginAs(creatorPage, CREATOR_EMAIL);
    const creatorCookie = await sessionCookie(creatorPage);
    // 直接打 API；schema 应当在 .url() 上叠加 startsWith http(s) 的校验。
    const resp = await request.post("/api/me/workflow-items", {
      headers: { cookie: creatorCookie },
      data: {
        title: `Stage 16.5 危险协议 ${Date.now()}`,
        description: "试图通过 javascript: scheme 注入 Location 头。",
        priceCents: 1999,
        category: "COMFYUI_WORKFLOW",
        downloadUrl: "javascript:alert(1)",
      },
    });
    expect(resp.status()).toBe(400);
    await creatorCtx.close();
  });

  // ─────────────── 限流顺序 ───────────────

  test("60 次 bad-token redeem 不应使紧随其后的合法 redeem 触发 429", async ({
    browser,
    request,
  }) => {
    const paid = await createPaidWorkflowOrder({ browser, request });
    const mint = await request.post(
      `/api/orders/${paid.orderNo}/download-url`,
      { headers: { cookie: paid.buyerCookie } },
    );
    const goodUrl: string = (await mint.json()).data.url;

    // 一口气 60 次坏 token —— 全部应 401，且**不应**扣 redeem 桶（rate-limit 在验签之后）。
    for (let i = 0; i < 60; i++) {
      const r = await request.get(
        `/api/orders/${paid.orderNo}/download?t=v1.aaaa.bbbb`,
        { maxRedirects: 0 },
      );
      // 期望 401（签名错）— 一旦看到 429 即说明 rate-limit 被错位扣过头。
      expect([401]).toContain(r.status());
    }
    // 紧接着用合法 token 应仍可 302。
    const ok = await request.get(goodUrl, { maxRedirects: 0 });
    expect(ok.status()).toBe(302);
  });

  test("checkout HTML / 订单详情 API 都不包含卖家裸 download URL", async ({
    browser,
    request,
  }) => {
    const paid = await createPaidWorkflowOrder({ browser, request });

    // 1) /api/orders/<orderNo> JSON 响应不能包含裸 URL
    const detail = await request.get(`/api/orders/${paid.orderNo}`, {
      headers: { cookie: paid.buyerCookie },
    });
    const detailBody = await detail.text();
    expect(detailBody).not.toContain(SELLER_DOWNLOAD_URL);
    const detailJson = JSON.parse(detailBody);
    expect(detailJson.data.workflowItem.downloadAvailable).toBe(true);

    // 2) /checkout/<orderNo> HTML 不能包含裸 URL（同 buyerCookie）
    const buyerCtx = await browser.newContext();
    const buyerPage = await buyerCtx.newPage();
    await loginAs(buyerPage, ADMIN_EMAIL);
    await buyerPage.goto(`/checkout/${paid.orderNo}`, {
      waitUntil: "domcontentloaded",
    });
    const html = await buyerPage.content();
    expect(html).not.toContain(SELLER_DOWNLOAD_URL);
    await expect(
      buyerPage.getByRole("button", { name: /下载工作流/ }),
    ).toBeVisible();
    await buyerCtx.close();
  });
});
