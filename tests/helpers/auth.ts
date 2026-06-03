import type { Page } from "@playwright/test";

/**
 * Seed 默认密码（见 prisma/seed.ts line 392）。
 * 测试外部传入的 password 优先生效。
 */
const SEED_PASSWORD = "seedland-dev-2026";

/**
 * 用 UI 登录并等待跳走 /auth/login。
 * identifier 可以是 email 或 username（登录表单字段叫 identifier）。
 */
export async function loginAs(
  page: Page,
  identifier: string,
  password: string = SEED_PASSWORD,
): Promise<void> {
  await page.goto("/auth/login");
  await page.fill('input[name="identifier"]', identifier);
  await page.fill('input[name="password"]', password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/auth/"), {
      timeout: 15_000,
    }),
    page.click('button[type="submit"]'),
  ]);
}
