import { expect, test } from "@playwright/test";

import { loginAs } from "./helpers/auth";

/**
 * Stage 6 验收 —— 频道成员 + 静态页 + Stage 6 审计后的硬化项。
 *
 * 覆盖：
 *  - 鉴权：401 未登录、404 非法 channelId
 *  - 入参校验：400 拒绝过长/非法 channelId
 *  - 业务：toggle 两次回到初始态、memberCount 反向变化
 *  - 浏览器交互：登录后点击 JoinChannelButton 文案在「加入频道」「已加入」之间切换
 *  - 安全：/auth/login?next=//evil.com 不能重定向到外部域名
 *  - 6 个静态页 H1 可见
 *
 *  Run: npx playwright test stage6
 */

const ADMIN_EMAIL = "admin@aivideohub.com";

const STATIC_PAGES = [
  { path: "/about", title: "关于 SeedLand" },
  { path: "/contact", title: "联系我们" },
  { path: "/legal/terms", title: "服务条款" },
  { path: "/legal/privacy", title: "隐私政策" },
  { path: "/community/rules", title: "社区公约" },
  { path: "/community/creator-program", title: "创作者计划" },
];

test.describe("Stage 6 · 频道成员 + 静态页", () => {
  test("未登录调用 members/toggle 返回 401", async ({ request }) => {
    const res = await request.post(
      "/api/channels/abc123/members/toggle",
    );
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test("登录后非法/超长 channelId 返回 400", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL);
    // 含空格 — 不在 [a-zA-Z0-9_-] 中
    const longBad = "x".repeat(200);
    const res = await page.request.post(
      `/api/channels/${encodeURIComponent(longBad)}/members/toggle`,
    );
    expect(res.status()).toBe(400);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(false);
  });

  test("登录后合法但不存在的 channelId 返回 404", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL);
    const res = await page.request.post(
      "/api/channels/__nonexistent__/members/toggle",
    );
    expect(res.status()).toBe(404);
  });

  test("toggle 两次回到初始状态 + memberCount 反向变化", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL);
    const channels = await page.request.get("/api/channels");
    if (!channels.ok()) test.skip(true, "/api/channels 不可用");
    const body = (await channels.json()) as {
      data?: { items?: Array<{ id: string }> } | Array<{ id: string }>;
    };
    const raw = body?.data;
    const list = Array.isArray(raw) ? raw : raw?.items;
    if (!list || list.length === 0) test.skip(true, "无可用 channel，跳过");
    const targetId = list![0].id;

    const first = await page.request.post(
      `/api/channels/${encodeURIComponent(targetId)}/members/toggle`,
    );
    expect(first.status()).toBe(200);
    const firstBody = (await first.json()) as {
      data?: { member: boolean; memberCount: number };
    };
    expect(firstBody.data).toBeTruthy();
    const flipped = firstBody.data!.member;
    const countAfterFirst = firstBody.data!.memberCount;

    const second = await page.request.post(
      `/api/channels/${encodeURIComponent(targetId)}/members/toggle`,
    );
    expect(second.status()).toBe(200);
    const secondBody = (await second.json()) as {
      data?: { member: boolean; memberCount: number };
    };
    expect(secondBody.data!.member).toBe(!flipped);
    // 第二次反向，count 应该相比第一次也反向（+1 / -1）
    expect(Math.abs(secondBody.data!.memberCount - countAfterFirst)).toBe(1);
  });

  test("浏览器交互：点击 JoinChannelButton 文案在「加入频道」「已加入」之间切换", async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL);
    const channels = await page.request.get("/api/channels");
    if (!channels.ok()) test.skip(true, "/api/channels 不可用");
    const body = (await channels.json()) as {
      data?: { items?: Array<{ id: string; slug?: string }> } | Array<{
        id: string;
        slug?: string;
      }>;
    };
    const raw = body?.data;
    const list = Array.isArray(raw) ? raw : raw?.items;
    if (!list || list.length === 0) test.skip(true, "无可用 channel，跳过");
    const target = list![0];
    const slug = target.slug ?? target.id;

    await page.goto(`/community/${encodeURIComponent(slug)}`);
    // 用 aria-pressed 找到唯一的 JoinChannelButton（不依赖 i18n 文案）
    const btn = page
      .locator('button[aria-pressed][type="button"]')
      .filter({ hasText: /加入|已加入/ })
      .first();
    await expect(btn).toBeVisible();
    const initialPressed = await btn.getAttribute("aria-pressed");
    const initialLabel = (await btn.textContent())?.trim() ?? "";

    await btn.click();
    // 等 aria-pressed 翻转
    await expect(btn).toHaveAttribute(
      "aria-pressed",
      initialPressed === "true" ? "false" : "true",
    );
    const afterLabel = (await btn.textContent())?.trim() ?? "";
    expect(afterLabel).not.toBe(initialLabel);

    // 还原现场
    await btn.click();
    await expect(btn).toHaveAttribute("aria-pressed", initialPressed!);
  });

  test("安全：/auth/login?next=//evil.com 不接受作为站内 next 参数", async ({
    page,
  }) => {
    // 未登录视角：banner 文案只在合法 next 时渲染，所以不应出现
    await page.goto("/auth/login?next=" + encodeURIComponent("//evil.com/x"));
    const banner = page.getByText("登录后将带你回到");
    await expect(banner).toHaveCount(0);
    // 同样应当未渲染恶意 host 字符串到 DOM 中
    const body = (await page.locator("body").textContent()) ?? "";
    expect(body.includes("evil.com")).toBe(false);
  });

  test("安全：已登录访问 /auth/login?next=//evil.com 会被重定向到默认页（而非跨站）", async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL);
    // 登录态访问 login 页会触发 redirect(next ?? `/profile/<id>`)
    await page.goto("/auth/login?next=" + encodeURIComponent("//evil.com/x"), {
      waitUntil: "domcontentloaded",
    });
    const finalUrl = page.url();
    expect(finalUrl).not.toContain("evil.com");
    // 必须仍然在我们的 origin 上，且落在 profile/* 默认页
    expect(finalUrl).toMatch(/\/profile\//);
  });

  test("安全：/auth/login?next=/community 接受合法站内 next", async ({ page }) => {
    await page.goto("/auth/login?next=" + encodeURIComponent("/community"));
    await expect(page.getByText("登录后将带你回到")).toBeVisible();
  });

  for (const p of STATIC_PAGES) {
    test(`静态页 ${p.path} 渲染成功`, async ({ page }) => {
      const resp = await page.goto(p.path);
      expect(resp?.status() ?? 500).toBeLessThan(400);
      await expect(
        page.getByRole("heading", { level: 1, name: p.title }),
      ).toBeVisible();
    });
  }
});
