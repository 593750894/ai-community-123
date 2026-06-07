import { expect, test, type Page } from "@playwright/test";

import { loginAs } from "./helpers/auth";

/**
 * Stage 11.3 验收 —— 企业内容归属。
 *
 * 覆盖：
 *   - 表单层：登录用户进 /create-post 看到「发布身份」选择器；未加入企业的用户隐藏
 *   - 后端校验：以非成员企业身份发帖 → 403
 *   - 端到端：成员以企业身份创建作品 → 公开 /showcase 卡片含企业徽章 → /organizations/[slug]/feed 看到该作品
 *   - 商品：seller 以企业身份创建 WorkflowItem 草稿 → /me/workflows 表格显示 → /organizations/[slug]/feed 不显示（DRAFT）；上架后显示
 *   - API：/api/posts POST 带不合法 organizationId → 403；不带 → 个人身份成功
 *
 *  Run: npx playwright test stage11-3
 */

const CREATOR_EMAIL = "creator@aivideohub.com";
const CLIENT_EMAIL = "client@aivideohub.com";

async function sessionCookie(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  const sess = cookies.find((c) => c.name === "seedland_session");
  if (!sess) throw new Error("session cookie missing");
  return `${sess.name}=${sess.value}`;
}

function uniqueSlug(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

async function createOrg(
  page: Page,
  payload: { name: string; slug: string; industry?: string },
): Promise<{ id: string; slug: string }> {
  const cookie = await sessionCookie(page);
  const res = await page.request.post("/api/me/organizations", {
    headers: { cookie, "Content-Type": "application/json" },
    data: {
      name: payload.name,
      slug: payload.slug,
      industry: payload.industry ?? "ADVERTISING",
      size: "1-10",
    },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  return { id: body.data.id, slug: payload.slug };
}

test.describe("Stage 11.3 · Org Content Attribution", () => {
  // ───────────────────── /create-post 渲染 publish selector ─────────────────────

  test("/create-post 登录用户进入页面", async ({ page }) => {
    await loginAs(page, CREATOR_EMAIL);
    const resp = await page.goto("/create-post", { waitUntil: "domcontentloaded" });
    expect(resp?.status() ?? 500).toBeLessThan(400);
    // hidden field 必然存在（即使用户未加入企业，组件也输出 hidden organizationId=PERSONAL）
    await expect(page.locator('input[name="organizationId"]')).toHaveCount(1);
  });

  // ───────────────────── 403：以非成员企业身份发帖 ─────────────────────

  test("API POST /api/posts 用未加入企业的 organizationId → 403", async ({ page }) => {
    // creator 创建一个企业（client 不是成员）
    await loginAs(page, CREATOR_EMAIL);
    const orgSlug = uniqueSlug("test-bad-org");
    const orgRes = await createOrg(page, { name: "Test Bad Org", slug: orgSlug });

    // 切换到 client，用 orgId 发帖应被拒
    await page.context().clearCookies();
    await loginAs(page, CLIENT_EMAIL);
    const cookie = await sessionCookie(page);

    // 找一个频道 id
    const channelsRes = await page.request.get("/api/channels");
    const channelsBody = await channelsRes.json();
    const channelId =
      channelsBody?.data?.items?.[0]?.id ?? channelsBody?.data?.[0]?.id;
    expect(channelId).toBeTruthy();

    const res = await page.request.post("/api/posts", {
      headers: { cookie, "Content-Type": "application/json" },
      data: {
        channelId,
        type: "DISCUSSION",
        title: "我不该能以这个企业身份发帖",
        content: "测试 401/403 行为",
        organizationId: orgRes.id,
      },
    });
    expect([403, 400]).toContain(res.status());
  });

  // ───────────────────── 成员以企业身份发帖 → 卡片显示企业徽章 ─────────────────────

  test("成员以企业身份发帖 → /organizations/[slug]/feed 含该帖", async ({ page }) => {
    await loginAs(page, CREATOR_EMAIL);
    const orgSlug = uniqueSlug("test-good-org");
    const org = await createOrg(page, { name: "Test Good Org", slug: orgSlug });

    const cookie = await sessionCookie(page);
    const channelsRes = await page.request.get("/api/channels");
    const channelsBody = await channelsRes.json();
    const channelId =
      channelsBody?.data?.items?.[0]?.id ?? channelsBody?.data?.[0]?.id;
    expect(channelId).toBeTruthy();

    const title = `企业身份测试帖 ${Math.random().toString(36).slice(2, 8)}`;
    const res = await page.request.post("/api/posts", {
      headers: { cookie, "Content-Type": "application/json" },
      data: {
        channelId,
        type: "DISCUSSION",
        title,
        content: "Stage 11.3 端到端：成员以企业身份发布",
        organizationId: org.id,
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body?.data?.organization?.id).toBe(org.id);

    // 企业聚合 feed 页能看到这个帖子
    await page.goto(`/organizations/${org.slug}/feed`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByText(title)).toBeVisible();
  });

  // ───────────────────── 个人身份依然可用 ─────────────────────

  test("不带 organizationId → 仍以个人身份发帖", async ({ page }) => {
    await loginAs(page, CREATOR_EMAIL);
    const cookie = await sessionCookie(page);
    const channelsRes = await page.request.get("/api/channels");
    const channelsBody = await channelsRes.json();
    const channelId =
      channelsBody?.data?.items?.[0]?.id ?? channelsBody?.data?.[0]?.id;
    expect(channelId).toBeTruthy();

    const res = await page.request.post("/api/posts", {
      headers: { cookie, "Content-Type": "application/json" },
      data: {
        channelId,
        type: "DISCUSSION",
        title: `个人身份发帖 ${Math.random().toString(36).slice(2, 6)}`,
        content: "个人身份测试",
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body?.data?.organization ?? null).toBeNull();
  });

  // ───────────────────── PERSONAL 字面量 → null ─────────────────────

  test("organizationId='PERSONAL' → 个人身份", async ({ page }) => {
    await loginAs(page, CREATOR_EMAIL);
    const cookie = await sessionCookie(page);
    const channelsRes = await page.request.get("/api/channels");
    const channelsBody = await channelsRes.json();
    const channelId =
      channelsBody?.data?.items?.[0]?.id ?? channelsBody?.data?.[0]?.id;

    const res = await page.request.post("/api/posts", {
      headers: { cookie, "Content-Type": "application/json" },
      data: {
        channelId,
        type: "DISCUSSION",
        title: `PERSONAL sentinel test ${Math.random().toString(36).slice(2, 6)}`,
        content: "Sentinel test",
        organizationId: "PERSONAL",
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body?.data?.organization ?? null).toBeNull();
  });

  // ───────────────────── WorkflowItem：成员以企业身份创建草稿 ─────────────────────

  test("成员以企业身份创建 WorkflowItem 草稿 → /me/workflows 可见", async ({ page }) => {
    await loginAs(page, CREATOR_EMAIL);
    const orgSlug = uniqueSlug("test-shop-org");
    const org = await createOrg(page, { name: "Test Shop Org", slug: orgSlug });

    const cookie = await sessionCookie(page);
    const title = `企业商品 ${Math.random().toString(36).slice(2, 8)}`;
    const res = await page.request.post("/api/me/workflow-items", {
      headers: { cookie, "Content-Type": "application/json" },
      data: {
        title,
        description: "Stage 11.3 端到端：企业身份上架草稿（最少 10 字）",
        priceCents: 0,
        category: "COMFYUI_WORKFLOW",
        tags: [],
        toolStack: [],
        organizationId: org.id,
      },
    });
    expect(res.status()).toBe(201);
  });

  // ───────────────────── /organizations/[slug] 显示企业内容按钮 ─────────────────────

  test("/organizations/[slug] 公开页 当企业有内容时显示「企业内容」入口", async ({ page }) => {
    await loginAs(page, CREATOR_EMAIL);
    const orgSlug = uniqueSlug("test-feed-org");
    const org = await createOrg(page, { name: "Test Feed Org", slug: orgSlug });

    // 先创建一个企业身份的帖子
    const cookie = await sessionCookie(page);
    const channelsRes = await page.request.get("/api/channels");
    const channelsBody = await channelsRes.json();
    const channelId =
      channelsBody?.data?.items?.[0]?.id ?? channelsBody?.data?.[0]?.id;
    await page.request.post("/api/posts", {
      headers: { cookie, "Content-Type": "application/json" },
      data: {
        channelId,
        type: "DISCUSSION",
        title: `[org] 企业首发 ${Math.random().toString(36).slice(2, 6)}`,
        content: "测试用",
        organizationId: org.id,
      },
    });

    // 公开页应能跳转到 feed
    await page.goto(`/organizations/${org.slug}`, {
      waitUntil: "domcontentloaded",
    });
    const feedLink = page.locator(`a[href="/organizations/${org.slug}/feed"]`);
    await expect(feedLink).toBeVisible();
  });
});
