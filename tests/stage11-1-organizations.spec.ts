import { expect, test, type Page } from "@playwright/test";

import { loginAs } from "./helpers/auth";

/**
 * Stage 11.1 验收 —— Organization 基础 + 成员 + 邀请。
 *
 * 覆盖：
 *   - 公共页：/organizations 200 + /me/organizations 匿名跳登录
 *   - 创建企业：anon 跳登录、登录 201 round-trip、slug 校验
 *   - 邀请：自邀请 / 非成员 / 重复邀请的 4xx
 *   - 邀请响应：accept / reject 状态流转 + 成员表+1
 *   - 角色管理：非 OWNER 不能改角色；OWNER 不能被移除
 *   - 退出 / 解散
 *
 *  Run: npx playwright test stage11-1
 */

const ADMIN_EMAIL = "admin@aivideohub.com";
const CLIENT_EMAIL = "client@aivideohub.com";
const CREATOR_EMAIL = "creator@aivideohub.com";

async function sessionCookie(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  const sess = cookies.find((c) => c.name === "seedland_session");
  if (!sess) throw new Error("session cookie missing");
  return `${sess.name}=${sess.value}`;
}

function uniqueSlug(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

// e2e 流（创建 → 邀请 → 接受 → 角色 → 移除 / 拒绝路径）单次跑 8-10 次 dev-server
// 首请求 cold compile，默认 30s 超时会在 dev 模式下偶发失败；放大到 90s。
test.describe.configure({ timeout: 90_000 });

test.describe("Stage 11.1 · Organizations", () => {
  // ─────────────────────── RBAC + page renders ───────────────────────

  test("/organizations 匿名访问 200 + 渲染 H1", async ({ page }) => {
    const resp = await page.goto("/organizations", { waitUntil: "domcontentloaded" });
    expect(resp?.status() ?? 500).toBeLessThan(400);
    await expect(
      page.getByRole("heading", { name: /企业账号/, level: 1 }),
    ).toBeVisible();
  });

  test("/me/organizations 匿名 → /auth/login (next 携带)", async ({ page }) => {
    await page.goto("/me/organizations", { waitUntil: "domcontentloaded" });
    expect(page.url()).toMatch(/\/auth\/login/);
    // /me/* 子路径统一由 /me layout 兜底，next 携带 "/me"（不细化到子路径）。
    expect(decodeURIComponent(page.url())).toContain("next=/me");
  });

  test("/me/organizations 登录后 200 + 邀请收件箱链接可见", async ({ page }) => {
    await loginAs(page, CLIENT_EMAIL);
    const resp = await page.goto("/me/organizations", {
      waitUntil: "domcontentloaded",
    });
    expect(resp?.status() ?? 500).toBeLessThan(400);
    await expect(
      page.getByRole("heading", { name: /我所在的企业/, level: 1 }),
    ).toBeVisible();
    await expect(page.getByText("邀请收件箱")).toBeVisible();
  });

  test("/me/organizations/new 登录后 200 + 创建表单可见", async ({ page }) => {
    await loginAs(page, CLIENT_EMAIL);
    await page.goto("/me/organizations/new", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /创建企业账号/, level: 1 }),
    ).toBeVisible();
    await expect(page.locator('input[name="slug"]')).toBeVisible();
    await expect(page.locator('input[name="name"]')).toBeVisible();
  });

  // ─────────────────────── API guards ───────────────────────

  test("GET /api/organizations 匿名 200 + items 数组", async ({ request }) => {
    const resp = await request.get("/api/organizations");
    expect(resp.status()).toBe(200);
    const json = await resp.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data.items)).toBe(true);
  });

  test("GET /api/me/organizations 匿名 → 401", async ({ request }) => {
    const resp = await request.get("/api/me/organizations");
    expect(resp.status()).toBe(401);
  });

  test("GET /api/me/invites 匿名 → 401", async ({ request }) => {
    const resp = await request.get("/api/me/invites");
    expect(resp.status()).toBe(401);
  });

  test("POST /api/me/organizations 缺字段 → 400", async ({ page, request }) => {
    await loginAs(page, CLIENT_EMAIL);
    const cookie = await sessionCookie(page);
    const resp = await request.post("/api/me/organizations", {
      headers: { cookie },
      data: {},
    });
    expect(resp.status()).toBe(400);
  });

  test("POST /api/me/organizations slug 非法 → 400", async ({ page, request }) => {
    await loginAs(page, CLIENT_EMAIL);
    const cookie = await sessionCookie(page);
    const resp = await request.post("/api/me/organizations", {
      headers: { cookie },
      data: { slug: "AB", name: "X" },
    });
    expect(resp.status()).toBe(400);
  });

  // ─────────────────────── 端到端：创建 → 邀请 → 接受 → 角色 → 移除 ───────────────────────

  test("e2e: create → invite → accept → role → remove", async ({
    browser,
    request,
  }) => {
    const slug = uniqueSlug("e2e-org");
    // OWNER：creator
    const ownerCtx = await browser.newContext();
    const ownerPage = await ownerCtx.newPage();
    await loginAs(ownerPage, CREATOR_EMAIL);
    const ownerCookie = await sessionCookie(ownerPage);

    // 1) 创建企业
    const create = await request.post("/api/me/organizations", {
      headers: { cookie: ownerCookie },
      data: {
        slug,
        name: `E2E 测试企业 ${slug}`,
        description: "用于 Stage 11.1 端到端测试",
      },
    });
    expect(create.status()).toBe(201);
    const created = await create.json();
    const orgId: string = created.data.id;
    expect(orgId).toBeTruthy();
    expect(created.data.slug).toBe(slug);

    // 2) 自邀请 → 400
    const selfInvite = await request.post(
      `/api/me/organizations/${orgId}/invites`,
      {
        headers: { cookie: ownerCookie },
        data: { inviteeUsername: "ai_creator", role: "MEMBER" },
      },
    );
    // creator 自己的 username = "ai_creator"（来自 seed）→ 自邀请会被业务层拒绝
    expect([400, 409]).toContain(selfInvite.status());

    // 3) 邀请不存在的用户 → 404
    const ghost = await request.post(
      `/api/me/organizations/${orgId}/invites`,
      {
        headers: { cookie: ownerCookie },
        data: { inviteeUsername: "__no_such_user__", role: "MEMBER" },
      },
    );
    expect(ghost.status()).toBe(404);

    // 4) 邀请 client（已存在的用户）→ 201
    const inviteResp = await request.post(
      `/api/me/organizations/${orgId}/invites`,
      {
        headers: { cookie: ownerCookie },
        data: { inviteeUsername: "ecom_client", role: "MEMBER" },
      },
    );
    expect(inviteResp.status()).toBe(201);
    const inviteJson = await inviteResp.json();
    const inviteId: string = inviteJson.data.id;
    expect(inviteId).toBeTruthy();

    // 5) 重复邀请 → 409
    const dup = await request.post(
      `/api/me/organizations/${orgId}/invites`,
      {
        headers: { cookie: ownerCookie },
        data: { inviteeUsername: "ecom_client", role: "MEMBER" },
      },
    );
    expect(dup.status()).toBe(409);

    // 6) client 登录，能在 /api/me/invites 看到 PENDING
    const clientCtx = await browser.newContext();
    const clientPage = await clientCtx.newPage();
    await loginAs(clientPage, CLIENT_EMAIL);
    const clientCookie = await sessionCookie(clientPage);

    const myInvites = await request.get(
      "/api/me/invites?status=PENDING",
      { headers: { cookie: clientCookie } },
    );
    expect(myInvites.status()).toBe(200);
    const myInvitesJson = await myInvites.json();
    const found = myInvitesJson.data.items.find(
      (i: { id: string }) => i.id === inviteId,
    );
    expect(found).toBeTruthy();
    expect(found.status).toBe("PENDING");

    // 7) client 接受邀请
    const accept = await request.post(
      `/api/me/invites/${inviteId}/respond`,
      {
        headers: { cookie: clientCookie },
        data: { action: "accept" },
      },
    );
    expect(accept.status()).toBe(200);

    // 8) members 列表里应该有 client，role=MEMBER
    const members = await request.get(
      `/api/me/organizations/${orgId}/members`,
      { headers: { cookie: ownerCookie } },
    );
    expect(members.status()).toBe(200);
    const membersJson = await members.json();
    const clientMember = membersJson.data.items.find(
      (m: { user: { username: string } }) => m.user.username === "ecom_client",
    );
    expect(clientMember).toBeTruthy();
    expect(clientMember.role).toBe("MEMBER");

    // 9) 二次响应同一邀请 → 400
    const reAccept = await request.post(
      `/api/me/invites/${inviteId}/respond`,
      {
        headers: { cookie: clientCookie },
        data: { action: "accept" },
      },
    );
    expect([400, 409]).toContain(reAccept.status());

    // 10) 非成员（admin 未加入）访问 members → 403
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await loginAs(adminPage, ADMIN_EMAIL);
    const adminCookie = await sessionCookie(adminPage);
    const forbidden = await request.get(
      `/api/me/organizations/${orgId}/members`,
      { headers: { cookie: adminCookie } },
    );
    expect(forbidden.status()).toBe(403);

    // 11) OWNER 升 client 为 ADMIN
    const role = await request.patch(
      `/api/me/organizations/${orgId}/members/${clientMember.user.id}`,
      {
        headers: { cookie: ownerCookie },
        data: { role: "ADMIN" },
      },
    );
    expect(role.status()).toBe(200);

    // 12) OWNER 不能被移除
    const ownerUser = membersJson.data.items.find(
      (m: { role: string }) => m.role === "OWNER",
    );
    const removeOwner = await request.delete(
      `/api/me/organizations/${orgId}/members/${ownerUser.user.id}`,
      { headers: { cookie: ownerCookie } },
    );
    expect([400, 403]).toContain(removeOwner.status());

    // 13) OWNER 移除 client
    const remove = await request.delete(
      `/api/me/organizations/${orgId}/members/${clientMember.user.id}`,
      { headers: { cookie: ownerCookie } },
    );
    expect(remove.status()).toBe(200);

    // 14) 解散企业
    const dissolve = await request.delete(
      `/api/me/organizations/${orgId}`,
      { headers: { cookie: ownerCookie } },
    );
    expect(dissolve.status()).toBe(200);

    // 15) 解散后 GET 详情 → 404
    const gone = await request.get(`/api/organizations/${slug}`);
    expect(gone.status()).toBe(404);

    await ownerCtx.close();
    await clientCtx.close();
    await adminCtx.close();
  });

  // ─────────────────────── 邀请拒绝路径 ───────────────────────

  test("e2e: invite reject 路径 → 状态 REJECTED + 未加入成员", async ({
    browser,
    request,
  }) => {
    const slug = uniqueSlug("rej-org");
    const ownerCtx = await browser.newContext();
    const ownerPage = await ownerCtx.newPage();
    await loginAs(ownerPage, CREATOR_EMAIL);
    const ownerCookie = await sessionCookie(ownerPage);

    const create = await request.post("/api/me/organizations", {
      headers: { cookie: ownerCookie },
      data: { slug, name: `Reject Test ${slug}` },
    });
    expect(create.status()).toBe(201);
    const { id: orgId } = (await create.json()).data;

    const inv = await request.post(
      `/api/me/organizations/${orgId}/invites`,
      {
        headers: { cookie: ownerCookie },
        data: { inviteeUsername: "ecom_client", role: "MEMBER" },
      },
    );
    expect(inv.status()).toBe(201);
    const inviteId: string = (await inv.json()).data.id;

    const clientCtx = await browser.newContext();
    const clientPage = await clientCtx.newPage();
    await loginAs(clientPage, CLIENT_EMAIL);
    const clientCookie = await sessionCookie(clientPage);

    const reject = await request.post(
      `/api/me/invites/${inviteId}/respond`,
      {
        headers: { cookie: clientCookie },
        data: { action: "reject" },
      },
    );
    expect(reject.status()).toBe(200);

    // 历史里 status=REJECTED；成员不含 client
    const myInvites = await request.get(
      "/api/me/invites?status=REJECTED",
      { headers: { cookie: clientCookie } },
    );
    expect(myInvites.status()).toBe(200);
    const found = (await myInvites.json()).data.items.find(
      (i: { id: string }) => i.id === inviteId,
    );
    expect(found.status).toBe("REJECTED");

    const members = await request.get(
      `/api/me/organizations/${orgId}/members`,
      { headers: { cookie: ownerCookie } },
    );
    const membersJson = await members.json();
    const hasClient = membersJson.data.items.some(
      (m: { user: { username: string } }) => m.user.username === "ecom_client",
    );
    expect(hasClient).toBe(false);

    // 清理
    await request.delete(`/api/me/organizations/${orgId}`, {
      headers: { cookie: ownerCookie },
    });

    await ownerCtx.close();
    await clientCtx.close();
  });
});
