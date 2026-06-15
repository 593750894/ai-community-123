import { expect, test, type Page } from "@playwright/test";

import { loginAs } from "./helpers/auth";

/**
 * Stage 16.4 验收：分润后退款的 ClawbackRequest 流程。
 *
 * 三类验证：
 * 1. /admin/clawbacks 页 RBAC + 渲染。
 * 2. POST /api/admin/clawbacks/[id]/resolve 各路 guard（401 / 403 / 400 / 404）。
 * 3. refundOrder → 已 PAID payout 会产生 ClawbackRequest（在 lib 层覆盖；端到端那条 happy path
 *    依赖 cron 把 PENDING → AVAILABLE，受 7 天冷藏期限制不在 e2e 范围）。
 *
 *  Run: npx playwright test stage16-4-clawback
 */

const ADMIN_EMAIL = "admin@aivideohub.com";
const CLIENT_EMAIL = "client@aivideohub.com";

async function sessionCookie(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  const sess = cookies.find((c) => c.name === "seedland_session");
  if (!sess) throw new Error("session cookie missing");
  return `${sess.name}=${sess.value}`;
}

test.describe("Stage 16.4 · /admin/clawbacks + resolve API", () => {
  test("/admin/clawbacks 匿名 → /auth/login", async ({ page }) => {
    await page.goto("/admin/clawbacks", { waitUntil: "domcontentloaded" });
    expect(page.url()).toMatch(/\/auth\/login/);
  });

  test("/admin/clawbacks 非 admin → 跳首页 reason=admin-only", async ({ page }) => {
    await loginAs(page, CLIENT_EMAIL);
    await page.goto("/admin/clawbacks", { waitUntil: "domcontentloaded" });
    expect(page.url()).toMatch(/\/\?reason=admin-only/);
  });

  test("/admin/clawbacks admin → 200 + 标题 + 状态筛选", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL);
    const resp = await page.goto("/admin/clawbacks", {
      waitUntil: "domcontentloaded",
    });
    expect(resp?.status() ?? 500).toBeLessThan(400);
    await expect(
      page.getByRole("heading", { name: /退款追讨/, level: 1 }),
    ).toBeVisible();
    // 状态筛选 chip
    await expect(page.getByText(/待处理/).first()).toBeVisible();
  });

  test("POST /api/admin/clawbacks/x/resolve 匿名 → 401", async ({ request }) => {
    const resp = await request.post("/api/admin/clawbacks/x/resolve", {
      data: { toStatus: "WAIVED" },
    });
    expect(resp.status()).toBe(401);
  });

  test("POST /api/admin/clawbacks/x/resolve 非 admin → 403", async ({
    page,
    request,
  }) => {
    await loginAs(page, CLIENT_EMAIL);
    const cookie = await sessionCookie(page);
    const resp = await request.post("/api/admin/clawbacks/x/resolve", {
      headers: { cookie },
      data: { toStatus: "WAIVED" },
    });
    expect(resp.status()).toBe(403);
  });

  test("POST resolve DEDUCTED 缺备注 → 400", async ({ page, request }) => {
    await loginAs(page, ADMIN_EMAIL);
    const cookie = await sessionCookie(page);
    const resp = await request.post(
      "/api/admin/clawbacks/anything/resolve",
      {
        headers: { cookie },
        data: { toStatus: "DEDUCTED" }, // note 必填
      },
    );
    expect(resp.status()).toBe(400);
  });

  test("POST resolve 不存在的 id → 404", async ({ page, request }) => {
    await loginAs(page, ADMIN_EMAIL);
    const cookie = await sessionCookie(page);
    const resp = await request.post(
      "/api/admin/clawbacks/does-not-exist-xxx/resolve",
      {
        headers: { cookie },
        data: { toStatus: "WAIVED" },
      },
    );
    expect(resp.status()).toBe(404);
  });

  test("POST resolve 非法 toStatus → 400", async ({ page, request }) => {
    await loginAs(page, ADMIN_EMAIL);
    const cookie = await sessionCookie(page);
    const resp = await request.post(
      "/api/admin/clawbacks/anything/resolve",
      {
        headers: { cookie },
        data: { toStatus: "BANANA" },
      },
    );
    expect(resp.status()).toBe(400);
  });
});
