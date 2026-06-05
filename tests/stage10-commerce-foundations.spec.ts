import { expect, test } from "@playwright/test";

import { loginAs } from "./helpers/auth";

/**
 * Stage 10.1 验收 —— 商业化基础（公共展示层 + 卖家中心，无支付）。
 *
 * 覆盖：
 *  - /pricing 200（匿名可访问），头部渲染
 *  - /marketplace 200（匿名），渲染分类筛选
 *  - /marketplace/<bad-id> → 404
 *  - /me/workflows 匿名 → /auth/login?next=...
 *  - /me/workflows 登录后 200，渲染头部 + 新建商品按钮
 *  - /me/workflows/new 登录后 200，渲染表单字段
 *  - sidebar 含「工作流市集」「会员计划」「我的商品」（登录态下）
 *  - GET /api/marketplace/workflow-items 200，结构正确
 *  - GET /api/me/workflow-items 未登录 → 401
 *  - POST /api/me/workflow-items 登录后参数校验 + 创建草稿
 *  - GET /api/pricing/plans 200
 *
 *  Run: npx playwright test stage10
 */

const ADMIN_EMAIL = "admin@aivideohub.com";

test.describe("Stage 10.1 · 商业化基础", () => {
  test("/pricing 匿名 200 并渲染头部", async ({ page }) => {
    const resp = await page.goto("/pricing", { waitUntil: "domcontentloaded" });
    expect(resp?.status() ?? 500).toBeLessThan(400);
    await expect(
      page.getByRole("heading", { name: /会员|解锁/, level: 1 }),
    ).toBeVisible();
  });

  test("/marketplace 匿名 200 并渲染分类筛选", async ({ page }) => {
    const resp = await page.goto("/marketplace", {
      waitUntil: "domcontentloaded",
    });
    expect(resp?.status() ?? 500).toBeLessThan(400);
    await expect(
      page.getByRole("heading", { name: /工作流|发现/, level: 1 }),
    ).toBeVisible();
    const body = (await page.locator("body").textContent()) ?? "";
    expect(body).toContain("ComfyUI");
  });

  test("/marketplace/<bad-id> → 404", async ({ page }) => {
    const resp = await page.goto("/marketplace/zzz-not-a-cuid", {
      waitUntil: "domcontentloaded",
    });
    expect(resp?.status()).toBe(404);
  });

  test("/me/workflows 匿名跳 /auth/login?next=/me/workflows", async ({
    page,
  }) => {
    await page.goto("/me/workflows", { waitUntil: "domcontentloaded" });
    expect(page.url()).toMatch(/\/auth\/login/);
    expect(decodeURIComponent(page.url())).toContain("next=/me/workflows");
  });

  test("登录后 /me/workflows 200 渲染头部与新建按钮", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL);
    const resp = await page.goto("/me/workflows", {
      waitUntil: "domcontentloaded",
    });
    expect(resp?.status() ?? 500).toBeLessThan(400);
    await expect(
      page.getByRole("heading", { name: /我的工作流|管理/, level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /新建商品/ }).first(),
    ).toBeVisible();
  });

  test("登录后 /me/workflows/new 200 渲染表单", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL);
    const resp = await page.goto("/me/workflows/new", {
      waitUntil: "domcontentloaded",
    });
    expect(resp?.status() ?? 500).toBeLessThan(400);
    await expect(page.locator('input[name="title"]')).toBeVisible();
    await expect(page.locator('select[name="category"]')).toBeVisible();
    await expect(page.locator('input[name="priceYuan"]')).toBeVisible();
  });

  test("sidebar 含工作流市集 + 会员计划 + 我的商品", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const aside = page.locator("aside").first();
    await expect(
      aside.getByRole("link", { name: /工作流市集/ }),
    ).toBeVisible();
    await expect(aside.getByRole("link", { name: /会员计划/ })).toBeVisible();
    await expect(aside.getByRole("link", { name: /我的商品/ })).toBeVisible();
  });

  test("GET /api/marketplace/workflow-items 200 + 结构", async ({
    request,
  }) => {
    const resp = await request.get("/api/marketplace/workflow-items");
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.items)).toBe(true);
    expect(typeof body.data.total).toBe("number");
    expect(typeof body.data.page).toBe("number");
    expect(typeof body.data.pageSize).toBe("number");
  });

  test("GET /api/pricing/plans 200 + plans 数组", async ({ request }) => {
    const resp = await request.get("/api/pricing/plans");
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.plans)).toBe(true);
  });

  test("GET /api/me/workflow-items 匿名 → 401", async ({ request }) => {
    const resp = await request.get("/api/me/workflow-items");
    expect(resp.status()).toBe(401);
  });

  test("POST /api/me/workflow-items 校验失败 → 400", async ({ page, request }) => {
    await loginAs(page, ADMIN_EMAIL);
    const cookies = await page.context().cookies();
    const sess = cookies.find((c) => c.name === "seedland_session");
    if (!sess) throw new Error("session cookie missing");
    const resp = await request.post("/api/me/workflow-items", {
      headers: { cookie: `${sess.name}=${sess.value}` },
      data: { title: "x" }, // 太短，缺字段
    });
    expect(resp.status()).toBe(400);
  });

  test("POST /api/me/workflow-items 创建草稿 → 201", async ({ page, request }) => {
    await loginAs(page, ADMIN_EMAIL);
    const cookies = await page.context().cookies();
    const sess = cookies.find((c) => c.name === "seedland_session");
    if (!sess) throw new Error("session cookie missing");
    const resp = await request.post("/api/me/workflow-items", {
      headers: { cookie: `${sess.name}=${sess.value}` },
      data: {
        title: `Stage10.1 测试草稿 ${Date.now()}`,
        description: "这是一个 Stage 10.1 验收用的测试草稿描述，至少十个字。",
        priceCents: 1990,
        category: "COMFYUI_WORKFLOW",
        tags: ["test"],
        toolStack: ["ComfyUI"],
      },
    });
    expect(resp.status()).toBe(201);
    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(typeof body.data.id).toBe("string");
  });
});
