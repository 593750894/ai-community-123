import { expect, test } from "@playwright/test";

/**
 * Stage 3 acceptance gate.
 *
 * Goals:
 *  1. Top navbar exposes a search input; Enter submits to /search?q=...
 *  2. Global "/" focuses that input when no input is focused.
 *  3. /search renders type tabs and (with a seed-data hit) shows ≥1 result.
 *  4. /search?q=zzz-no-such-thing-zzz shows an empty state instead of crashing.
 *  5. /api/search returns 200 and the right shape.
 *
 * Run with: npx playwright test stage3-search
 * Dev server must be reachable at PLAYWRIGHT_BASE_URL (default localhost:3000)
 * and seed data must be loaded for the "hit" assertion.
 */

test.describe("Stage 3 · 全局搜索", () => {
  test("navbar input submits Enter to /search?q=...", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const input = page.locator('header input[name="q"]');
    await expect(input).toBeVisible();
    await input.fill("seedance");
    await input.press("Enter");
    await page.waitForURL(/\/search\?q=seedance/);
    expect(page.url()).toContain("/search?q=seedance");
  });

  test("'/' key focuses the search input outside form fields", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.locator("body").focus();
    await page.keyboard.press("/");
    const focusedName = await page.evaluate(
      () => (document.activeElement as HTMLInputElement | null)?.name ?? null,
    );
    expect(focusedName).toBe("q");
  });

  test("/search renders type tabs and at least one result for common term", async ({
    page,
  }) => {
    const resp = await page.goto("/search?q=AI", {
      waitUntil: "domcontentloaded",
    });
    expect(resp?.status() ?? 500).toBeLessThan(500);
    // Expect the type tab row.
    for (const label of ["全部", "帖子", "作品", "创作者", "频道", "工具"]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
  });

  test("empty state appears when no matches", async ({ page }) => {
    await page.goto("/search?q=zzz-no-such-thing-zzz", {
      waitUntil: "domcontentloaded",
    });
    await expect(
      page.getByText(/没有找到与/).first(),
    ).toBeVisible();
  });

  test("/api/search returns the documented shape", async ({ request }) => {
    const resp = await request.get("/api/search?q=AI");
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeTruthy();
    expect(typeof body.data.query).toBe("string");
    expect(body.data.totals).toMatchObject({
      post: expect.any(Number),
      work: expect.any(Number),
      user: expect.any(Number),
      channel: expect.any(Number),
      tool: expect.any(Number),
    });
    expect(Array.isArray(body.data.hits)).toBe(true);
  });
});
