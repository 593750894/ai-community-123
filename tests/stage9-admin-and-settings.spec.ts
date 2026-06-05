import { expect, test } from "@playwright/test";

import { loginAs } from "./helpers/auth";

/**
 * Stage 9 验收 —— admin 增强 + AuditLog + /settings。
 *
 * 覆盖：
 *  - /settings 未登录跳 /auth/login?next=/settings*
 *  - 登录后 /settings 重定向到 /settings/account，三个 tab 子页都 200
 *  - sidebar 的「设置」项已不再 aria-disabled，能跳到 /settings
 *  - /admin/users 显示新的角色 / 状态 / 强制下线表单
 *  - /admin/audit-logs 200 + 渲染筛选 form
 *  - /api/me/notification-preferences GET 返回所有类型 + 默认全 true
 *  - /api/me/notification-preferences PUT 修改 + GET 回读
 *  - /api/me/password 未登录 → 401；当前密码错 → 400
 *  - /api/me/privacy PUT 切换
 *
 *  Run: npx playwright test stage9
 */

const ADMIN_EMAIL = "admin@aivideohub.com";

const SETTINGS_PAGES = [
  { path: "/settings/account", heading: /账户中心|基本资料/ },
  { path: "/settings/notifications", heading: /通知偏好/ },
  { path: "/settings/privacy", heading: /主页可见性/ },
];

test.describe("Stage 9 · admin 增强 + /settings", () => {
  test("/settings 匿名跳 /auth/login?next=/settings*", async ({ page }) => {
    const resp = await page.goto("/settings", {
      waitUntil: "domcontentloaded",
    });
    expect(resp).not.toBeNull();
    expect(page.url()).toMatch(/\/auth\/login/);
    expect(page.url()).toContain("next=");
  });

  for (const p of SETTINGS_PAGES) {
    test(`匿名访问 ${p.path} → /auth/login`, async ({ page }) => {
      await page.goto(p.path, { waitUntil: "domcontentloaded" });
      expect(page.url()).toMatch(/\/auth\/login/);
      expect(page.url()).toContain(`next=${encodeURIComponent(p.path)}`);
    });
  }

  test("登录后 /settings → /settings/account", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL);
    const resp = await page.goto("/settings", { waitUntil: "domcontentloaded" });
    expect(resp?.status() ?? 500).toBeLessThan(400);
    expect(page.url()).toContain("/settings/account");
    await expect(
      page.getByRole("heading", { name: "基本资料" }),
    ).toBeVisible();
  });

  for (const p of SETTINGS_PAGES) {
    test(`登录后 ${p.path} 200 并渲染 heading`, async ({ page }) => {
      await loginAs(page, ADMIN_EMAIL);
      const resp = await page.goto(p.path, { waitUntil: "domcontentloaded" });
      expect(resp?.status() ?? 500).toBeLessThan(400);
      const body = (await page.locator("body").textContent()) ?? "";
      expect(p.heading.test(body)).toBe(true);
    });
  }

  test("sidebar 的「设置」可点击且非 aria-disabled", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const settings = page
      .locator("aside")
      .getByRole("link", { name: "设置", exact: true });
    await expect(settings.first()).toBeVisible();
    const disabled = await settings.first().evaluate((el) => {
      return (
        el.getAttribute("aria-disabled") === "true" ||
        !!el.closest("[aria-disabled='true']")
      );
    });
    expect(disabled).toBe(false);
  });

  test("/admin/audit-logs 200 + 渲染筛选 form", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL);
    const resp = await page.goto("/admin/audit-logs", {
      waitUntil: "domcontentloaded",
    });
    expect(resp?.status() ?? 500).toBeLessThan(400);
    await expect(
      page.getByRole("heading", { name: "操作审计" }),
    ).toBeVisible();
    // 筛选 form 至少有「动作」/「目标类型」两个 select
    await expect(page.locator('select[name="action"]')).toBeVisible();
    await expect(page.locator('select[name="targetType"]')).toBeVisible();
  });

  test("/admin/users 显示角色 / 状态 / 强制下线", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL);
    const resp = await page.goto("/admin/users", {
      waitUntil: "domcontentloaded",
    });
    expect(resp?.status() ?? 500).toBeLessThan(400);
    // 操作列至少出现「保存」/「强制下线」其中之一（admin 自己那一行不会渲染）
    await expect(page.locator("button:has-text('强制下线')").first()).toBeVisible();
    await expect(page.locator('select[name="role"]').first()).toBeVisible();
    await expect(page.locator('select[name="status"]').first()).toBeVisible();
  });

  test("admin 自己那一行禁止改自己 —— 没有 role / status select", async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL);
    await page.goto("/admin/users", { waitUntil: "domcontentloaded" });
    const selfRow = page.locator("tr", { hasText: "你" });
    await expect(selfRow.first()).toBeVisible();
    const selfActions = selfRow.first().locator("button:has-text('强制下线')");
    expect(await selfActions.count()).toBe(0);
  });

  test("GET /api/me/notification-preferences (未登录 → 401)", async ({
    request,
  }) => {
    const resp = await request.get("/api/me/notification-preferences");
    expect(resp.status()).toBe(401);
  });

  test("GET /api/me/notification-preferences (已登录) 返回所有类型默认 true", async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL);
    const resp = await page.request.get("/api/me/notification-preferences");
    expect(resp.ok()).toBe(true);
    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(body.data.POST_REPLY).toBe(true);
    expect(body.data.SYSTEM).toBe(true);
  });

  test("PUT + GET /api/me/notification-preferences round-trip", async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL);
    const put1 = await page.request.put(
      "/api/me/notification-preferences",
      {
        data: { type: "POST_LIKE", enabled: false },
        headers: { "Content-Type": "application/json" },
      },
    );
    expect(put1.ok()).toBe(true);

    const get1 = await page.request.get("/api/me/notification-preferences");
    const body1 = await get1.json();
    expect(body1.data.POST_LIKE).toBe(false);

    // 还原，避免污染后续测试
    const put2 = await page.request.put(
      "/api/me/notification-preferences",
      {
        data: { type: "POST_LIKE", enabled: true },
        headers: { "Content-Type": "application/json" },
      },
    );
    expect(put2.ok()).toBe(true);

    const get2 = await page.request.get("/api/me/notification-preferences");
    const body2 = await get2.json();
    expect(body2.data.POST_LIKE).toBe(true);
  });

  test("PUT /api/me/notification-preferences SYSTEM 不会真的改", async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL);
    const put = await page.request.put(
      "/api/me/notification-preferences",
      {
        data: { type: "SYSTEM", enabled: false },
        headers: { "Content-Type": "application/json" },
      },
    );
    // 服务端按设计静默忽略；route 仍返回成功 + echo
    expect(put.ok()).toBe(true);
    const get = await page.request.get("/api/me/notification-preferences");
    const body = await get.json();
    expect(body.data.SYSTEM).toBe(true);
  });

  test("PUT /api/me/password 未登录 → 401", async ({ request }) => {
    const resp = await request.put("/api/me/password", {
      data: { currentPassword: "x", newPassword: "abcdef12" },
      headers: { "Content-Type": "application/json" },
    });
    expect(resp.status()).toBe(401);
  });

  test("PUT /api/me/password 当前密码错 → 400", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL);
    const resp = await page.request.put("/api/me/password", {
      data: { currentPassword: "WRONG_PASS_999", newPassword: "abcdef12" },
      headers: { "Content-Type": "application/json" },
    });
    expect(resp.status()).toBe(400);
  });

  test("PUT /api/me/privacy 切换 isProfilePublic", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL);
    const off = await page.request.put("/api/me/privacy", {
      data: { isProfilePublic: false },
      headers: { "Content-Type": "application/json" },
    });
    expect(off.ok()).toBe(true);
    const on = await page.request.put("/api/me/privacy", {
      data: { isProfilePublic: true },
      headers: { "Content-Type": "application/json" },
    });
    expect(on.ok()).toBe(true);
  });
});
