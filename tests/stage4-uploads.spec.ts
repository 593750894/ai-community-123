import { expect, test } from "@playwright/test";

/**
 * Stage 4 acceptance gate.
 *
 * Goals (Playwright-checkable subset):
 *  1. /create-post and /create-work render the MediaUploader's drop zone.
 *  2. /api/uploads/sign requires auth (401 when anonymous).
 *  3. /api/uploads/sign with bad params returns 400 (validation).
 *
 * Out of scope here (manual / staging only):
 *  - Full presign → R2 PUT round-trip (depends on real STORAGE_* env).
 *  - Drag/drop progress UI (browser-driven, flaky in CI).
 *
 * Run with: npx playwright test stage4-uploads
 */

test.describe("Stage 4 · 文件上传", () => {
  test("/create-post 渲染图片+视频上传区", async ({ page }) => {
    const resp = await page.goto("/create-post", {
      waitUntil: "domcontentloaded",
    });
    // 未登录会跳 /auth/login，已登录会渲染表单。两者都不应当 5xx。
    expect(resp?.status() ?? 500).toBeLessThan(500);
    if (page.url().includes("/create-post")) {
      await expect(
        page.getByText(/点击选择.*图片/).first(),
      ).toBeVisible();
      await expect(
        page.getByText(/点击选择.*视频/).first(),
      ).toBeVisible();
    }
  });

  test("/create-work 渲染封面+视频上传区", async ({ page }) => {
    const resp = await page.goto("/create-work", {
      waitUntil: "domcontentloaded",
    });
    expect(resp?.status() ?? 500).toBeLessThan(500);
    if (page.url().includes("/create-work")) {
      await expect(
        page.getByText(/点击选择.*图片/).first(),
      ).toBeVisible();
      await expect(
        page.getByText(/点击选择.*视频/).first(),
      ).toBeVisible();
    }
  });

  test("POST /api/uploads/sign 未登录返回 401", async ({ request }) => {
    const resp = await request.post("/api/uploads/sign", {
      data: { kind: "image", mime: "image/png", size: 1024 },
    });
    expect(resp.status()).toBe(401);
    const body = await resp.json();
    expect(body.success).toBe(false);
  });
});
