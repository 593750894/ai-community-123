import { createHmac } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { loginAs } from "./helpers/auth";

/**
 * Stage 10.5 验收 —— 创作者收益（/me/earnings）+ 结算管理（/admin/payouts）。
 *
 * 覆盖：
 *   - RBAC：/me/earnings 匿名跳登录 + 登录后 200；/admin/payouts 非 admin 跳首页 + admin 200
 *   - API guards：所有新增 endpoint 的 401/403 + 200 round-trip
 *   - 收款账号 PUT round-trip
 *   - 申请提现：无 AVAILABLE → 409
 *   - cron：无 token → 403；正确 token → 200 + finalized 数字
 *   - 端到端：creator 上架工作流 → admin 下单 + mock pay → creator /me/payouts 看到 PENDING
 *
 *  Run: npx playwright test stage10-5
 */

const ADMIN_EMAIL = "admin@aivideohub.com";
const CLIENT_EMAIL = "client@aivideohub.com";
const CREATOR_EMAIL = "creator@aivideohub.com";
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

async function sessionCookie(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  const sess = cookies.find((c) => c.name === "seedland_session");
  if (!sess) throw new Error("session cookie missing");
  return `${sess.name}=${sess.value}`;
}

test.describe("Stage 10.5 · /me/earnings + /admin/payouts", () => {
  // ─────────────────────── RBAC + page renders ───────────────────────

  test("/me/earnings 匿名 → /auth/login (next 携带)", async ({ page }) => {
    await page.goto("/me/earnings", { waitUntil: "domcontentloaded" });
    expect(page.url()).toMatch(/\/auth\/login/);
    expect(decodeURIComponent(page.url())).toContain("next=/me/earnings");
  });

  test("/me/earnings 登录后 200 + 渲染 H1 + 收款账号表单", async ({ page }) => {
    await loginAs(page, CREATOR_EMAIL);
    const resp = await page.goto("/me/earnings", {
      waitUntil: "domcontentloaded",
    });
    expect(resp?.status() ?? 500).toBeLessThan(400);
    await expect(
      page.getByRole("heading", { name: /创作者收益与结算/, level: 1 }),
    ).toBeVisible();
    await expect(page.getByText("收款账号", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: /保存账号/ })).toBeVisible();
  });

  test("/admin/payouts 非 admin → 跳首页 (reason=admin-only)", async ({ page }) => {
    await loginAs(page, CLIENT_EMAIL);
    await page.goto("/admin/payouts", { waitUntil: "domcontentloaded" });
    expect(page.url()).toMatch(/\/\?reason=admin-only/);
  });

  test("/admin/payouts admin → 200 + 渲染统计卡 + 状态筛选", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL);
    const resp = await page.goto("/admin/payouts", {
      waitUntil: "domcontentloaded",
    });
    expect(resp?.status() ?? 500).toBeLessThan(400);
    await expect(
      page.getByRole("heading", { name: /结算管理/, level: 1 }),
    ).toBeVisible();
    await expect(page.getByText(/可申请提现总额/)).toBeVisible();
    await expect(page.getByText(/待处理提现/).first()).toBeVisible();
  });

  // ─────────────────────── API guards ───────────────────────

  test("GET /api/me/earnings 匿名 → 401", async ({ request }) => {
    const resp = await request.get("/api/me/earnings");
    expect(resp.status()).toBe(401);
  });

  test("GET /api/me/earnings 登录 → 200 + summary 结构", async ({
    page,
    request,
  }) => {
    await loginAs(page, CREATOR_EMAIL);
    const cookie = await sessionCookie(page);
    const resp = await request.get("/api/me/earnings", {
      headers: { cookie },
    });
    expect(resp.status()).toBe(200);
    const json = await resp.json();
    expect(json.success).toBe(true);
    expect(json.data).toHaveProperty("totalNetCents");
    expect(json.data).toHaveProperty("byStatus");
    expect(json.data.byStatus).toHaveProperty("PENDING");
    expect(json.data.byStatus).toHaveProperty("AVAILABLE");
    expect(json.data).toHaveProperty("platformFeeBps");
    expect(json.data).toHaveProperty("payoutHoldDays");
  });

  test("GET /api/me/payouts 匿名 → 401", async ({ request }) => {
    const resp = await request.get("/api/me/payouts");
    expect(resp.status()).toBe(401);
  });

  test("GET /api/me/payouts 登录 → 200 + 分页结构", async ({
    page,
    request,
  }) => {
    await loginAs(page, CREATOR_EMAIL);
    const cookie = await sessionCookie(page);
    const resp = await request.get("/api/me/payouts?pageSize=5", {
      headers: { cookie },
    });
    expect(resp.status()).toBe(200);
    const json = await resp.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data.items)).toBe(true);
  });

  test("GET /api/me/payouts?status=BAD → 400", async ({ page, request }) => {
    await loginAs(page, CREATOR_EMAIL);
    const cookie = await sessionCookie(page);
    const resp = await request.get("/api/me/payouts?status=NOPE", {
      headers: { cookie },
    });
    expect(resp.status()).toBe(400);
  });

  test("GET /api/admin/payouts 非 admin → 403", async ({ page, request }) => {
    await loginAs(page, CLIENT_EMAIL);
    const cookie = await sessionCookie(page);
    const resp = await request.get("/api/admin/payouts", {
      headers: { cookie },
    });
    expect(resp.status()).toBe(403);
  });

  test("GET /api/admin/payouts 匿名 → 401", async ({ request }) => {
    const resp = await request.get("/api/admin/payouts");
    expect(resp.status()).toBe(401);
  });

  test("GET /api/admin/payouts admin → 200 + overview 字段", async ({
    page,
    request,
  }) => {
    await loginAs(page, ADMIN_EMAIL);
    const cookie = await sessionCookie(page);
    const resp = await request.get("/api/admin/payouts?status=AVAILABLE", {
      headers: { cookie },
    });
    expect(resp.status()).toBe(200);
    const json = await resp.json();
    expect(json.success).toBe(true);
    expect(json.data).toHaveProperty("overview");
    expect(json.data.overview).toHaveProperty("availableNetCents");
    expect(json.data.overview).toHaveProperty("pendingRequestCount");
  });

  test("POST /api/admin/payouts/:id/mark-paid 匿名 → 401", async ({
    request,
  }) => {
    const resp = await request.post(
      "/api/admin/payouts/non-existent/mark-paid",
      { data: {} },
    );
    expect(resp.status()).toBe(401);
  });

  test("POST /api/admin/payouts/:id/mark-paid 非 admin → 403", async ({
    page,
    request,
  }) => {
    await loginAs(page, CLIENT_EMAIL);
    const cookie = await sessionCookie(page);
    const resp = await request.post(
      "/api/admin/payouts/non-existent/mark-paid",
      { headers: { cookie }, data: {} },
    );
    expect(resp.status()).toBe(403);
  });

  test("POST /api/admin/payouts/<bad-id>/mark-paid admin → 404", async ({
    page,
    request,
  }) => {
    await loginAs(page, ADMIN_EMAIL);
    const cookie = await sessionCookie(page);
    const resp = await request.post(
      "/api/admin/payouts/non-existent-id-xxx/mark-paid",
      { headers: { cookie }, data: {} },
    );
    expect(resp.status()).toBe(404);
  });

  // ─────────────────────── Payout account 绑定 ───────────────────────

  test("GET → PUT → GET /api/me/payout-account round-trip", async ({
    page,
    request,
  }) => {
    await loginAs(page, CREATOR_EMAIL);
    const cookie = await sessionCookie(page);

    // PUT 绑定
    const put = await request.put("/api/me/payout-account", {
      headers: { cookie },
      data: {
        payoutMethod: "ALIPAY",
        payoutAccount: "creator-test@aivideohub.com",
        payoutName: "测试创作者",
      },
    });
    expect(put.status()).toBe(200);
    const putJson = await put.json();
    expect(putJson.data.hasAccount).toBe(true);
    expect(putJson.data.payoutMethod).toBe("ALIPAY");

    // GET 读回
    const get = await request.get("/api/me/payout-account", {
      headers: { cookie },
    });
    expect(get.status()).toBe(200);
    const getJson = await get.json();
    expect(getJson.data.payoutAccount).toBe("creator-test@aivideohub.com");
    expect(getJson.data.payoutName).toBe("测试创作者");
  });

  test("PUT /api/me/payout-account 缺字段 → 400", async ({ page, request }) => {
    await loginAs(page, CREATOR_EMAIL);
    const cookie = await sessionCookie(page);
    const resp = await request.put("/api/me/payout-account", {
      headers: { cookie },
      data: { payoutMethod: "ALIPAY" },
    });
    expect(resp.status()).toBe(400);
  });

  test("PUT /api/me/payout-account 非法 method → 400", async ({
    page,
    request,
  }) => {
    await loginAs(page, CREATOR_EMAIL);
    const cookie = await sessionCookie(page);
    const resp = await request.put("/api/me/payout-account", {
      headers: { cookie },
      data: {
        payoutMethod: "BITCOIN",
        payoutAccount: "xxx",
        payoutName: "yyy",
      },
    });
    expect(resp.status()).toBe(400);
  });

  // ─────────────────────── 申请提现 ───────────────────────

  test("POST /api/me/payouts/request 匿名 → 401", async ({ request }) => {
    const resp = await request.post("/api/me/payouts/request");
    expect(resp.status()).toBe(401);
  });

  test("POST /api/me/payouts/request 无 AVAILABLE → 409", async ({
    page,
    request,
  }) => {
    // client@ 不是卖家也没有 payouts
    await loginAs(page, CLIENT_EMAIL);
    const cookie = await sessionCookie(page);
    // 先绑账号绕过 ValidationError 兜底（让走到 ConflictError）
    await request.put("/api/me/payout-account", {
      headers: { cookie },
      data: {
        payoutMethod: "ALIPAY",
        payoutAccount: "noone@example.com",
        payoutName: "无收益用户",
      },
    });
    const resp = await request.post("/api/me/payouts/request", {
      headers: { cookie },
    });
    // 没有 AVAILABLE payout → 409 CONFLICT
    expect(resp.status()).toBe(409);
  });

  test("POST /api/me/payouts/request 未绑账号 → 400", async ({
    page,
    request,
  }) => {
    // 用新注册账号也行，但 seed 的 admin@ 默认未绑账号。
    await loginAs(page, ADMIN_EMAIL);
    const cookie = await sessionCookie(page);
    // 主动确保 admin 未绑账号 — 这里测试期间可能被其他 test 污染过，跳过该用例如已绑定。
    const get = await request.get("/api/me/payout-account", {
      headers: { cookie },
    });
    const before = await get.json();
    if (before.data?.hasAccount) {
      test.skip(true, "admin 已绑账号，跳过未绑账号校验");
    }
    const resp = await request.post("/api/me/payouts/request", {
      headers: { cookie },
    });
    expect(resp.status()).toBe(400);
  });

  // ─────────────────────── cron auth ───────────────────────

  test("/api/cron/finalize-payouts 无 token → 403", async ({ request }) => {
    const resp = await request.get("/api/cron/finalize-payouts");
    expect(resp.status()).toBe(403);
  });

  test("/api/cron/finalize-payouts 错 token → 403", async ({ request }) => {
    const resp = await request.get("/api/cron/finalize-payouts", {
      headers: { authorization: "Bearer wrong-secret" },
    });
    expect(resp.status()).toBe(403);
  });

  test("/api/cron/finalize-payouts 正确 token → 200 + finalized 数字", async ({
    request,
  }) => {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      test.skip(true, "CRON_SECRET 未配置，跳过 cron 200 测试");
    }
    const resp = await request.get("/api/cron/finalize-payouts", {
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(resp.status()).toBe(200);
    const json = await resp.json();
    expect(json.success).toBe(true);
    expect(json.data).toHaveProperty("finalized");
    expect(typeof json.data.finalized).toBe("number");
  });

  // ─────────────────────── 端到端：上架 → 下单 → mock pay → Payout PENDING ───────────────────────

  test("creator 上架 → admin 下单 mock pay → creator /me/payouts 见到 PENDING", async ({
    browser,
    request,
  }) => {
    // creator 上架商品
    const creatorCtx = await browser.newContext();
    const creatorPage = await creatorCtx.newPage();
    await loginAs(creatorPage, CREATOR_EMAIL);
    const creatorCookie = await sessionCookie(creatorPage);

    const createItem = await request.post("/api/me/workflow-items", {
      headers: { cookie: creatorCookie },
      data: {
        title: "Stage 10.5 测试商品",
        description:
          "用于 stage10-5 端到端测试的工作流商品；可上架可被购买。",
        priceCents: 1999, // ¥19.99
        category: "COMFYUI_WORKFLOW",
        downloadUrl: "https://example.com/dl/stage105.zip",
      },
    });
    expect(createItem.status()).toBe(201);
    const itemJson = await createItem.json();
    const itemId = itemJson.data.id;
    expect(itemId).toBeTruthy();

    // 上架
    const pub = await request.patch(`/api/me/workflow-items/${itemId}`, {
      headers: { cookie: creatorCookie },
      data: { status: "PUBLISHED" },
    });
    expect(pub.status()).toBe(200);

    // admin 下单
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await loginAs(adminPage, ADMIN_EMAIL);
    const adminCookie = await sessionCookie(adminPage);

    const order = await request.post("/api/orders", {
      headers: { cookie: adminCookie },
      data: {
        type: "WORKFLOW_PURCHASE",
        workflowItemId: itemId,
        paymentMethod: "WECHAT_PAY",
      },
    });
    expect(order.status()).toBe(201);
    const orderJson = await order.json();
    const orderNo = orderJson.data.orderNo;
    const amountCents = orderJson.data.amountCents;
    expect(amountCents).toBe(1999);

    // mock pay
    const transactionId = `mock_${orderNo}`;
    const paidAt = new Date().toISOString();
    const sig = signMock({ orderNo, amountCents, transactionId, paidAt });
    const cb = await request.post("/api/payments/webhook/mock", {
      headers: { "x-mock-signature": sig },
      data: { orderNo, amountCents, transactionId, paidAt },
    });
    expect(cb.status()).toBe(200);

    // creator 在 /api/me/payouts 看到 PENDING
    const payouts = await request.get("/api/me/payouts?status=PENDING", {
      headers: { cookie: creatorCookie },
    });
    expect(payouts.status()).toBe(200);
    const payoutsJson = await payouts.json();
    expect(payoutsJson.data.total).toBeGreaterThan(0);
    const fresh = payoutsJson.data.items.find(
      (p: { orderNo: string }) => p.orderNo === orderNo,
    );
    expect(fresh).toBeTruthy();
    expect(fresh.status).toBe("PENDING");
    expect(fresh.grossCents).toBe(1999);
    // 平台默认抽成 30% → fee = floor(1999 * 0.3) = 599，net = 1400
    expect(fresh.platformFeeCents).toBeGreaterThan(0);
    expect(fresh.netCents).toBe(1999 - fresh.platformFeeCents);

    // earnings summary 同步反映
    const summary = await request.get("/api/me/earnings", {
      headers: { cookie: creatorCookie },
    });
    expect(summary.status()).toBe(200);
    const sjson = await summary.json();
    expect(sjson.data.byStatus.PENDING.count).toBeGreaterThan(0);

    await creatorCtx.close();
    await adminCtx.close();
  });
});
