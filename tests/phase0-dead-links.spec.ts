import { expect, test } from "@playwright/test";

/**
 * Phase 0 acceptance gate.
 *
 * Goals:
 *  1. Every visible <a> rendered by the persistent shell (navbar + sidebar +
 *     right-panel + mobile-nav) resolves to a non-404 page.
 *  2. Routes that we intentionally deferred to later phases are rendered as
 *     aria-disabled placeholders, NOT real anchors.
 *  3. The right-panel mocks (HOT_CREATORS / TRENDING_TAGS / EVENTS) are gone,
 *     and the hardcoded sidebar "本周热议 · Seedance 2.0 1080P" banner is gone.
 *
 * Run with: npx playwright test phase0-dead-links
 * Dev server must accept anonymous traffic to "/".
 */

// Static shell routes that should never 404.
const STATIC_SHELL_ROUTES = [
  "/",
  "/community",
  "/showcase",
  "/collaboration",
  "/tools",
  "/messages",
  "/auth/login",
  "/auth/register",
  "/create-work",
  "/create-post",
  "/admin",
];

// Labels that must exist on the homepage shell but must NOT be clickable links
// (routes deferred to future phases). Stage 9 enabled /settings, so the list is
// now empty — keep the array (and test below) for the next deferred label.
const DISABLED_LABELS: string[] = [];

// Mock strings deleted in Phase 0 — they must not appear anywhere on "/".
const DELETED_MOCK_STRINGS = [
  "本周热议 · Seedance 2.0 1080P",
  "Seedance 创作挑战赛 · 第 3 期",
  "AI 短剧编剧训练营",
  "SeedLand 月度 Showcase",
  "陈卷卷",
  "MidnightAI",
  "Pixel·林",
  "落日工作室",
  "首尾帧补间挑战赛",
];

test.describe("Phase 0 · 死链清理验收", () => {
  test("static shell routes do not return 404", async ({ page }) => {
    for (const path of STATIC_SHELL_ROUTES) {
      const resp = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(resp, `${path}: no response`).not.toBeNull();
      const status = resp!.status();
      expect(
        status,
        `${path}: status should be < 500 (got ${status})`,
      ).toBeLessThan(500);
      expect(status, `${path}: should not 404`).not.toBe(404);
      const url = page.url();
      // Allow auth-gated routes to redirect to /auth/login.
      const ok = url.includes(path) || url.includes("/auth/login");
      expect(ok, `${path}: ended at unexpected URL ${url}`).toBe(true);
    }
  });

  test("every shell anchor on / resolves (no 404)", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const hrefs = await page.evaluate(() => {
      const containers = document.querySelectorAll(
        "header, aside, nav",
      );
      const out = new Set<string>();
      containers.forEach((c) => {
        c.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((a) => {
          const href = a.getAttribute("href") ?? "";
          if (href.startsWith("/")) out.add(href);
        });
      });
      return Array.from(out);
    });

    expect(hrefs.length, "shell should expose at least a few anchors").toBeGreaterThan(
      4,
    );

    const failures: string[] = [];
    for (const href of hrefs) {
      const resp = await page.request.get(href, {
        maxRedirects: 5,
        failOnStatusCode: false,
      });
      if (resp.status() === 404) failures.push(`${href} -> 404`);
    }
    expect(failures, `dead links in shell:\n  ${failures.join("\n  ")}`).toEqual([]);
  });

  test("disabled placeholders render as non-anchor spans", async ({ page }) => {
    if (DISABLED_LABELS.length === 0) {
      test.skip(true, "no labels currently deferred");
      return;
    }
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Each label should appear at least once inside the shell, but never inside
    // an <a>. They should carry aria-disabled.
    const offenders: string[] = [];
    for (const label of DISABLED_LABELS) {
      const matches = page.getByText(label, { exact: true });
      const count = await matches.count();
      if (count === 0) {
        offenders.push(`label "${label}" missing entirely`);
        continue;
      }
      // Walk every match; at least one must be aria-disabled and none should
      // sit inside an <a>.
      let sawDisabled = false;
      for (let i = 0; i < count; i++) {
        const el = matches.nth(i);
        const isInAnchor = await el.evaluate((n) => !!n.closest("a"));
        if (isInAnchor) {
          offenders.push(`label "${label}" #${i} is inside <a>`);
        }
        const disabled = await el.evaluate((n) => {
          const target = (n as HTMLElement).closest("[aria-disabled='true']");
          return !!target;
        });
        if (disabled) sawDisabled = true;
      }
      if (!sawDisabled) {
        offenders.push(`label "${label}" never carries aria-disabled`);
      }
    }
    expect(offenders, `disabled-link offenders:\n  ${offenders.join("\n  ")}`).toEqual(
      [],
    );
  });

  test("deleted mock strings no longer appear on /", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const body = (await page.locator("body").textContent()) ?? "";
    const survivors = DELETED_MOCK_STRINGS.filter((s) => body.includes(s));
    expect(
      survivors,
      `mock strings still present:\n  ${survivors.join("\n  ")}`,
    ).toEqual([]);
  });

  test("right-panel 官方活动 section is gone", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    // Section header used to read "官方活动". Right panel only shows from xl
    // breakpoint, so widen the viewport before asserting.
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const count = await page
      .locator("aside")
      .getByText("官方活动", { exact: true })
      .count();
    expect(count, "官方活动 section should be deleted").toBe(0);
  });
});
