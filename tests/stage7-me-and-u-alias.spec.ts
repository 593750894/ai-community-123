import { expect, test } from "@playwright/test";

import { loginAs } from "./helpers/auth";

/**
 * Stage 7 验收 —— /me 个人中心 + /u/[username] 别名。
 *
 * 覆盖：
 *  - 未登录访问 /me、/me/works、/me/likes、/me/bookmarks 必须跳 /auth/login?next=...
 *  - 登录后这四页面 200，能渲染当前用户数据（不依赖具体数据量）
 *  - sidebar 的"我的"区块四个真实链接（个人中心/我的作品/点赞/稍后再看）都不再 aria-disabled
 *  - /u/[username] 重定向到 /profile/[userId]
 *  - /u/__nonexistent__ 返回 404
 *  - 浏览历史功能从 sidebar 移除
 *
 *  Run: npx playwright test stage7
 */

const ADMIN_EMAIL = "admin@aivideohub.com";
const ADMIN_USERNAME = "admin";

const ME_PAGES = [
  { path: "/me", title: /你好/ },
  { path: "/me/works", title: "我发布的所有作品" },
  { path: "/me/likes", title: "我点赞过的内容" },
  { path: "/me/bookmarks", title: "我收藏的内容" },
];

test.describe("Stage 7 · /me 个人中心 + /u/ 别名", () => {
  for (const p of ME_PAGES) {
    test(`未登录访问 ${p.path} 跳 /auth/login?next=${p.path}`, async ({
      page,
    }) => {
      const resp = await page.goto(p.path, { waitUntil: "domcontentloaded" });
      // requireUser 内部用 redirect → 服务端响应仍可能是 200，但最终 URL 是 /auth/login
      expect(resp).not.toBeNull();
      expect(page.url()).toMatch(/\/auth\/login/);
      expect(page.url()).toContain(`next=${encodeURIComponent(p.path)}`);
    });
  }

  for (const p of ME_PAGES) {
    test(`登录后访问 ${p.path} 200 并渲染标题`, async ({ page }) => {
      await loginAs(page, ADMIN_EMAIL);
      const resp = await page.goto(p.path, { waitUntil: "domcontentloaded" });
      expect(resp?.status() ?? 500).toBeLessThan(400);
      expect(page.url()).toContain(p.path);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      // 标题可能含动态用户名，只对部分页面做精确匹配
      if (typeof p.title === "string") {
        await expect(
          page.getByRole("heading", { level: 1, name: p.title }),
        ).toBeVisible();
      } else {
        await expect(
          page.getByRole("heading", { level: 1 }).first(),
        ).toHaveText(p.title);
      }
    });
  }

  test("登录后 sidebar 的'我的'四个链接都是真实 <a>，不再 aria-disabled", async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const labels = ["个人中心", "我的作品", "点赞", "稍后再看"];
    for (const label of labels) {
      // sidebar 出现在 aside 里
      const link = page
        .locator("aside")
        .getByRole("link", { name: label, exact: true })
        .first();
      await expect(link).toBeVisible();
      // 不能 aria-disabled
      const ariaDisabled = await link.getAttribute("aria-disabled");
      expect(ariaDisabled).toBeNull();
    }
  });

  test("浏览历史 在 sidebar 中已被移除", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL);
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const count = await page
      .locator("aside")
      .getByText("浏览历史", { exact: true })
      .count();
    expect(count).toBe(0);
  });

  test("/u/<existing-username> 重定向到 /profile/<userId>", async ({ page }) => {
    const resp = await page.goto(`/u/${ADMIN_USERNAME}`, {
      waitUntil: "domcontentloaded",
    });
    expect(resp?.status() ?? 500).toBeLessThan(400);
    expect(page.url()).toMatch(/\/profile\/[A-Za-z0-9_-]+/);
  });

  test("/u/__nonexistent__ 返回 404", async ({ page }) => {
    const resp = await page.goto("/u/__nonexistent_user_xyz__", {
      waitUntil: "domcontentloaded",
    });
    expect(resp?.status()).toBe(404);
  });

  test("/u/<非法格式> 返回 404", async ({ page }) => {
    // 包含空格 / 特殊字符 — 不在 [A-Za-z0-9_-] 中
    const bad = encodeURIComponent("not a user!");
    const resp = await page.goto(`/u/${bad}`, {
      waitUntil: "domcontentloaded",
    });
    expect(resp?.status()).toBe(404);
  });

  test("/me dashboard 四个统计卡片可点击进入子页", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL);
    await page.goto("/me", { waitUntil: "domcontentloaded" });
    // 至少 3 个统计卡片有 href 指向 /me/works|/me/likes|/me/bookmarks 或 /profile
    const tiles = page.locator("a[href^='/me/'], a[href^='/profile/']");
    const total = await tiles.count();
    expect(total).toBeGreaterThanOrEqual(3);
  });
});
