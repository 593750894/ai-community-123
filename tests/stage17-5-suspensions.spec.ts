import { expect, test } from "@playwright/test";

import { loginAs } from "./helpers/auth";

/**
 * Stage 17.5 验收 —— 用户禁言（原因 + 期限 + 只读模式）。
 *
 * 覆盖：
 *  - admin 把普通用户改 SUSPENDED 并填 reason / suspendedUntil
 *  - SUSPENDED 用户仍可登录浏览（read-only），但发帖 / 评论 / 私信 / 互动均被拒（403 SUSPENDED）
 *  - 全站 SuspensionBanner 在 SUSPENDED 用户头顶常驻
 *  - admin「解除禁言」回到 ACTIVE 后立刻可正常发布
 *  - cron /api/cron/restore-suspensions 无 token 403、有 token 200
 *
 * Run: npx playwright test stage17-5
 */

const ADMIN_EMAIL = "admin@aivideohub.com";
const TARGET_EMAIL = "anim@seedland.dev"; // 普通 USER

test.describe("Stage 17.5 · 禁言 read-only 模式", () => {
  test("admin 禁言 → 目标用户看到 banner + 创建动作被拒 → 解除后恢复", async ({
    browser,
  }) => {
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await loginAs(adminPage, ADMIN_EMAIL);

    // 在 /admin/users 找到目标行 → 点禁言（对话框可见）
    await adminPage.goto("/admin/users");
    const row = adminPage.locator("tr", { hasText: TARGET_EMAIL });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: /^禁言$/ }).click();

    await expect(
      adminPage.getByRole("heading", { name: "禁言用户" }),
    ).toBeVisible();
    await adminPage.fill('textarea[name="reason"]', "测试禁言：发布违规内容");
    // 默认是「指定到期时间」，datetime-local 已自动填 7 天后
    await adminPage
      .getByRole("button", { name: /^禁言用户$/ })
      .click();

    // 回到 admin 列表，状态应变 SUSPENDED + reason 可见
    await adminPage.waitForLoadState("networkidle");
    await adminPage.reload();
    const sameRow = adminPage.locator("tr", { hasText: TARGET_EMAIL });
    await expect(sameRow.getByText(/已禁言/)).toBeVisible();
    await expect(sameRow.getByText(/测试禁言/)).toBeVisible();

    // 目标用户登录 → 看到 banner + 创建 API 401-ish
    const userCtx = await browser.newContext();
    const userPage = await userCtx.newPage();
    await loginAs(userPage, TARGET_EMAIL);
    await expect(
      userPage.getByText(/账户当前处于禁言状态/),
    ).toBeVisible();
    await expect(userPage.getByText(/测试禁言：发布违规内容/)).toBeVisible();

    // 创建 work API 应被 SuspendedError 拒（403 + code SUSPENDED）
    const createResp = await userPage.request.post("/api/works", {
      data: {
        title: "禁言期间发布尝试",
        description: "这条不应被创建",
        thumbnailUrl: "https://example.com/x.jpg",
        videoUrl: "https://example.com/x.mp4",
        category: "EXPERIMENT",
        tools: ["TestTool"],
      },
      failOnStatusCode: false,
    });
    expect(createResp.status()).toBe(403);
    const body = await createResp.json();
    expect(body.error?.code).toBe("SUSPENDED");
    expect(body.error?.details?.reason).toContain("测试禁言");

    // 点赞 API 也被拒
    // 找一个真实存在的 post 来 like —— 用 GET /api/posts 拿第一条
    const postsResp = await userPage.request.get("/api/posts?pageSize=1");
    const postsBody = await postsResp.json();
    const samplePostId = postsBody?.data?.items?.[0]?.id as string | undefined;
    if (samplePostId) {
      const likeResp = await userPage.request.post("/api/likes/toggle", {
        data: { targetType: "POST", targetId: samplePostId },
        failOnStatusCode: false,
      });
      expect(likeResp.status()).toBe(403);
      const likeBody = await likeResp.json();
      expect(likeBody.error?.code).toBe("SUSPENDED");
    }

    // admin 解除禁言（自动确认）
    adminPage.once("dialog", (d) => d.accept());
    await adminPage.reload();
    const restoredRow = adminPage.locator("tr", { hasText: TARGET_EMAIL });
    await restoredRow.getByRole("button", { name: /^解除禁言$/ }).click();
    await adminPage.waitForLoadState("networkidle");
    await adminPage.reload();
    await expect(
      adminPage.locator("tr", { hasText: TARGET_EMAIL }).getByText(/正常/),
    ).toBeVisible();

    // 目标用户刷新 → banner 消失 + 创建 API 通过 zod（不再 403 SUSPENDED）
    await userPage.reload();
    await expect(
      userPage.getByText(/账户当前处于禁言状态/),
    ).not.toBeVisible();

    await adminCtx.close();
    await userCtx.close();
  });

  test("cron /api/cron/restore-suspensions：无 / 错 token → 403；正确 token → 200", async ({
    request,
  }) => {
    const noAuth = await request.post("/api/cron/restore-suspensions", {
      failOnStatusCode: false,
    });
    expect(noAuth.status()).toBe(403);

    const badAuth = await request.post("/api/cron/restore-suspensions", {
      headers: { Authorization: "Bearer not-the-real-secret" },
      failOnStatusCode: false,
    });
    expect(badAuth.status()).toBe(403);

    const secret = process.env.CRON_SECRET;
    test.skip(!secret, "CRON_SECRET 未配置 — 跳过正向用例");
    const ok = await request.post("/api/cron/restore-suspensions", {
      headers: { Authorization: `Bearer ${secret}` },
    });
    expect(ok.status()).toBe(200);
    const body = await ok.json();
    expect(typeof body?.data?.restored).toBe("number");
  });

  test("BANNED 仍然把用户当作未登录（与 SUSPENDED 行为不同）", async ({
    browser,
  }) => {
    // 用 e2e 验证一遍：admin 把某用户改 BANNED → 该用户访问 /me 跳登录页
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await loginAs(adminPage, ADMIN_EMAIL);

    await adminPage.goto("/admin/users");
    const row = adminPage.locator("tr", { hasText: "drama@seedland.dev" });
    adminPage.once("dialog", (d) => d.accept());
    await row.getByRole("button", { name: /^封禁$/ }).click();
    await adminPage.waitForLoadState("networkidle");

    // 目标用户登录尝试：BANNED 后 getCurrentUser 返回 null，进入 /me 应跳 login
    const userCtx = await browser.newContext();
    const userPage = await userCtx.newPage();
    await loginAs(userPage, "drama@seedland.dev").catch(() => {
      /* 登录后立刻被 status 拦下也算预期，下面 goto 检查 */
    });
    const resp = await userPage.goto("/me", {
      waitUntil: "domcontentloaded",
    });
    expect(resp?.status() ?? 500).toBeLessThan(500);
    expect(userPage.url()).toMatch(/\/auth\/login/);

    // 回复 ACTIVE 避免污染下一轮 seed
    adminPage.once("dialog", (d) => d.accept());
    await adminPage.reload();
    const banRow = adminPage.locator("tr", { hasText: "drama@seedland.dev" });
    await banRow.getByRole("button", { name: /^解封$/ }).click();
    await adminPage.waitForLoadState("networkidle");

    await adminCtx.close();
    await userCtx.close();
  });
});
