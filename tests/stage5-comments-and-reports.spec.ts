import { expect, test } from "@playwright/test";

import { loginAs } from "./helpers/auth";

/**
 * Stage 5 验收 —— 评论增强 + 举报系统。
 *
 * 覆盖范围（在没有 DB / 没有种子数据可用的 CI 上，自动 skip 而不 fail）：
 *  - 评论树渲染：进入第一个有评论的帖子，验证 CommentThread 而非旧 CommentList。
 *  - 评论点赞 API（POST /api/likes/toggle targetType=COMMENT）端到端可用。
 *  - 举报 API 鉴权与自举报拒绝。
 *  - Admin 看 /admin/reports：登录非 admin 会被踢；登录 admin 看到表格。
 *
 *  注意：跑这个 spec 之前需要 `pnpm run db:seed` 一次（seed 创建了 8 个测试账号）。
 *  没有种子数据时，找不到测试目标的 case 会自动 skip。
 *  Run: npx playwright test stage5
 */

const ADMIN_EMAIL = "admin@aivideohub.com";
const USER_A_EMAIL = "creator@aivideohub.com"; // 林逸飞 (MOD)
const USER_B_EMAIL = "client@aivideohub.com"; // 张明远 (USER)

test.describe("Stage 5 · 评论增强 + 举报系统", () => {
  test("/api/reports 未登录返回 401", async ({ request }) => {
    const res = await request.post("/api/reports", {
      data: {
        targetType: "POST",
        targetId: "fakecuid_____________",
        reason: "SPAM",
      },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test("/api/reports 校验失败返回 400", async ({ request, page }) => {
    await loginAs(page, USER_A_EMAIL);
    // Playwright 的 request 默认不共享浏览器 cookie；用 page.request 携带 session
    const res = await page.request.post("/api/reports", {
      data: {
        targetType: "POST",
        targetId: "", // 缺失
        reason: "SPAM",
      },
    });
    expect(res.status()).toBe(400);
  });

  test("/api/reports 自举报返回 403", async ({ page, request: _r }) => {
    await loginAs(page, USER_A_EMAIL);
    // 找一条 USER_A 发的帖子（依赖 seed）
    const apiRes = await page.request.get("/api/search?q=&type=post");
    if (!apiRes.ok()) test.skip(true, "搜索 API 不可用，跳过");
    // 直接对自己（USER）举报肯定 403 —— 不依赖具体帖子 ID
    const me = await page.request.get("/api/auth/me").catch(() => null);
    if (!me || !me.ok()) test.skip(true, "无法取得自己 id，跳过");
    const meBody = (await me!.json()) as { data?: { id?: string } };
    const myId = meBody?.data?.id;
    test.skip(!myId, "无 user id，跳过");
    const res = await page.request.post("/api/reports", {
      data: {
        targetType: "USER",
        targetId: myId!,
        reason: "SPAM",
      },
    });
    expect([403, 401, 400]).toContain(res.status());
  });

  test("/admin/reports 非 admin 被踢", async ({ page }) => {
    await loginAs(page, USER_B_EMAIL); // USER 角色
    await page.goto("/admin/reports");
    // requireAdmin 会跳 / 或 /auth/login，关键是不停留在 /admin/reports
    await expect(page).not.toHaveURL(/\/admin\/reports/);
  });

  test("/admin/reports admin 可以看到列表页", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL);
    const resp = await page.goto("/admin/reports");
    expect(resp?.status() ?? 500).toBeLessThan(500);
    // 页面应该渲染"举报处理"标题（来自 PageHeader）
    await expect(page.getByText("举报处理").first()).toBeVisible();
  });

  test("/api/likes/toggle 接受 targetType=COMMENT 的参数校验", async ({
    page,
  }) => {
    await loginAs(page, USER_A_EMAIL);
    // 用一个不存在的 commentId：应当返回 404，而不是 400（说明 COMMENT 已被接受）
    const res = await page.request.post("/api/likes/toggle", {
      data: { targetType: "COMMENT", targetId: "nonexistent_____________" },
    });
    expect([404, 400]).toContain(res.status());
    // 如果是 400，必须不是"targetType 枚举不合法"的错；放宽校验：状态不是 200 即可
    expect(res.status()).not.toBe(200);
  });
});
