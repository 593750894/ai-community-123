import { expect, test, type Page } from "@playwright/test";

import { loginAs } from "./helpers/auth";

/**
 * Stage 12.2 验收 —— 群聊 CRUD + 成员管理 + UI。
 *
 * 覆盖：
 *  - 公共路由：/messages/new、/messages/[id]/settings 鉴权
 *  - API guards：POST /api/conversations（1v1 兼容 + isGroup 分支）、PATCH/DELETE /[id]、
 *    POST/DELETE/PATCH /members*、POST /leave
 *  - 端到端：creator 创建群聊 → admin/client 入群 → 改名 → 升降级 → 踢人 → 退群 → 解散
 *  - RBAC：非成员 PATCH 403，MEMBER 改群信息 403，ADMIN 不能踢 ADMIN 403
 *
 *  Run: npx playwright test stage12-2
 */

const CREATOR_EMAIL = "creator@aivideohub.com";
const CLIENT_EMAIL = "client@aivideohub.com";

const CLIENT_USERNAME = "ecom_client";
const ADMIN_USERNAME = "admin";

async function sessionCookie(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  const sess = cookies.find((c) => c.name === "seedland_session");
  if (!sess) throw new Error("session cookie missing");
  return `${sess.name}=${sess.value}`;
}

async function lookupUserId(
  request: import("@playwright/test").APIRequestContext,
  cookie: string,
  username: string,
): Promise<string> {
  // 通过 /api/search 找用户 id（Stage 3 全局搜索已支持 user 类型）
  const resp = await request.get(
    `/api/search?q=${encodeURIComponent(username)}&type=user`,
    { headers: { cookie } },
  );
  expect(resp.status()).toBe(200);
  const json = await resp.json();
  const hits = (json.data?.hits ?? []) as Array<{
    type: string;
    id: string;
    username?: string;
  }>;
  const match = hits.find(
    (h) =>
      h.type === "user" &&
      h.username?.toLowerCase() === username.toLowerCase(),
  );
  if (!match)
    throw new Error(
      `lookupUserId: 找不到 username=${username}（hits=${JSON.stringify(hits)}）`,
    );
  return match.id;
}

test.describe("Stage 12.2 · Group chat CRUD + members", () => {
  // ───────────────────── RBAC + page renders ─────────────────────

  test("/messages/new 匿名 → /auth/login (next 携带)", async ({ page }) => {
    await page.goto("/messages/new", { waitUntil: "domcontentloaded" });
    expect(page.url()).toMatch(/\/auth\/login/);
    expect(decodeURIComponent(page.url())).toContain("next=/messages/new");
  });

  test("/messages/new 登录后 200 + 表单可见", async ({ page }) => {
    await loginAs(page, CREATOR_EMAIL);
    const resp = await page.goto("/messages/new", {
      waitUntil: "domcontentloaded",
    });
    expect(resp?.status() ?? 500).toBeLessThan(400);
    await expect(page.locator('input[name="title"]')).toBeVisible();
    await expect(page.locator('textarea[name="members"]')).toBeVisible();
  });

  // ───────────────────── API guards ─────────────────────

  test("POST /api/conversations 匿名 → 401", async ({ request }) => {
    const resp = await request.post("/api/conversations", {
      data: { isGroup: true, title: "x", memberIds: ["a", "b"] },
    });
    expect(resp.status()).toBe(401);
  });

  test("POST /api/conversations 群聊缺字段 → 400", async ({ page, request }) => {
    await loginAs(page, CREATOR_EMAIL);
    const cookie = await sessionCookie(page);
    const resp = await request.post("/api/conversations", {
      headers: { cookie },
      data: { isGroup: true, title: "" },
    });
    expect(resp.status()).toBe(400);
  });

  test("POST /api/conversations 1v1 旧路径仍正常（不带 isGroup）", async ({
    browser,
    request,
  }) => {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await loginAs(p, CREATOR_EMAIL);
    const cookie = await sessionCookie(p);
    const clientId = await lookupUserId(request, cookie, CLIENT_USERNAME);

    const resp = await request.post("/api/conversations", {
      headers: { cookie },
      data: { targetUserId: clientId },
    });
    expect([200, 201]).toContain(resp.status());
    const json = await resp.json();
    expect(json.success).toBe(true);
    expect(json.data?.isGroup).toBe(false);

    await ctx.close();
  });

  // ───────────────────── 端到端：创建 → 改名 → 升降级 → 踢 → 退群 → 解散 ─────────────────────

  test("e2e: create → rename → promote → demote → kick → leave → delete", async ({
    browser,
    request,
  }) => {
    // OWNER = creator
    const ownerCtx = await browser.newContext();
    const ownerPage = await ownerCtx.newPage();
    await loginAs(ownerPage, CREATOR_EMAIL);
    const ownerCookie = await sessionCookie(ownerPage);

    const clientId = await lookupUserId(request, ownerCookie, CLIENT_USERNAME);
    const adminId = await lookupUserId(request, ownerCookie, ADMIN_USERNAME);

    const title = `e2e-grp-${Math.random().toString(36).slice(2, 8)}`;

    // 1) 创建群聊
    const create = await request.post("/api/conversations", {
      headers: { cookie: ownerCookie },
      data: {
        isGroup: true,
        title,
        memberIds: [clientId, adminId],
      },
    });
    expect(create.status()).toBe(201);
    const created = await create.json();
    expect(created.success).toBe(true);
    const conversationId: string = created.data.id;
    expect(conversationId).toBeTruthy();
    expect(created.data.isGroup).toBe(true);
    expect(created.data.title).toBe(title);
    expect(created.data.ownerId).toBe(created.data.participants.find(
      (p: { role: string }) => p.role === "OWNER",
    ).userId);
    expect(created.data.participants).toHaveLength(3);

    // 2) GET /api/conversations/[id] 返回详情
    const get = await request.get(`/api/conversations/${conversationId}`, {
      headers: { cookie: ownerCookie },
    });
    expect(get.status()).toBe(200);

    // 3) 群名修改：OWNER 通过
    const renamed = `${title}-renamed`;
    const rename = await request.patch(
      `/api/conversations/${conversationId}`,
      { headers: { cookie: ownerCookie }, data: { title: renamed } },
    );
    expect(rename.status()).toBe(200);

    const after = await request.get(
      `/api/conversations/${conversationId}`,
      { headers: { cookie: ownerCookie } },
    );
    expect((await after.json()).data.title).toBe(renamed);

    // 4) client 是 MEMBER，PATCH 改群信息 → 403
    const clientCtx = await browser.newContext();
    const clientPage = await clientCtx.newPage();
    await loginAs(clientPage, CLIENT_EMAIL);
    const clientCookie = await sessionCookie(clientPage);
    const memberPatch = await request.patch(
      `/api/conversations/${conversationId}`,
      { headers: { cookie: clientCookie }, data: { title: "hack" } },
    );
    expect(memberPatch.status()).toBe(403);

    // 5) OWNER 升 client 为 ADMIN
    const promote = await request.patch(
      `/api/conversations/${conversationId}/members/${clientId}`,
      { headers: { cookie: ownerCookie }, data: { role: "ADMIN" } },
    );
    expect(promote.status()).toBe(200);

    // 6) ADMIN（client）现在能改群名了
    const clientRename = await request.patch(
      `/api/conversations/${conversationId}`,
      { headers: { cookie: clientCookie }, data: { title: `${title}-v2` } },
    );
    expect(clientRename.status()).toBe(200);

    // 7) ADMIN 不能踢另一个 ADMIN（我们手动先把 admin 也提为 ADMIN 试试）
    await request.patch(
      `/api/conversations/${conversationId}/members/${adminId}`,
      { headers: { cookie: ownerCookie }, data: { role: "ADMIN" } },
    );
    const clientKicksAdmin = await request.delete(
      `/api/conversations/${conversationId}/members/${adminId}`,
      { headers: { cookie: clientCookie } },
    );
    expect(clientKicksAdmin.status()).toBe(403);

    // 8) OWNER 把 admin 降回 MEMBER 然后 client 踢 admin → 200
    await request.patch(
      `/api/conversations/${conversationId}/members/${adminId}`,
      { headers: { cookie: ownerCookie }, data: { role: "MEMBER" } },
    );
    const clientKicksAdmin2 = await request.delete(
      `/api/conversations/${conversationId}/members/${adminId}`,
      { headers: { cookie: clientCookie } },
    );
    expect(clientKicksAdmin2.status()).toBe(200);

    // 9) OWNER 不能被踢
    const creatorId = created.data.ownerId;
    const kickOwner = await request.delete(
      `/api/conversations/${conversationId}/members/${creatorId}`,
      { headers: { cookie: clientCookie } },
    );
    expect([400, 403]).toContain(kickOwner.status());

    // 10) OWNER 自身不能退群
    const ownerLeave = await request.post(
      `/api/conversations/${conversationId}/leave`,
      { headers: { cookie: ownerCookie } },
    );
    expect(ownerLeave.status()).toBe(403);

    // 11) ADMIN（client）退群
    const clientLeave = await request.post(
      `/api/conversations/${conversationId}/leave`,
      { headers: { cookie: clientCookie } },
    );
    expect(clientLeave.status()).toBe(200);

    // 12) 退群后 client 访问群信息 → 403
    const afterLeave = await request.get(
      `/api/conversations/${conversationId}`,
      { headers: { cookie: clientCookie } },
    );
    expect(afterLeave.status()).toBe(403);

    // 13) OWNER 解散
    const del = await request.delete(
      `/api/conversations/${conversationId}`,
      { headers: { cookie: ownerCookie } },
    );
    expect(del.status()).toBe(200);

    // 14) 解散后 GET → 404
    const gone = await request.get(
      `/api/conversations/${conversationId}`,
      { headers: { cookie: ownerCookie } },
    );
    expect(gone.status()).toBe(404);

    await ownerCtx.close();
    await clientCtx.close();
  });

  // ───────────────────── 添加成员幂等 / 限制 ─────────────────────

  test("add members: 已在群内会被跳过；群成员重复请求不会爆", async ({
    browser,
    request,
  }) => {
    const ownerCtx = await browser.newContext();
    const ownerPage = await ownerCtx.newPage();
    await loginAs(ownerPage, CREATOR_EMAIL);
    const ownerCookie = await sessionCookie(ownerPage);
    const clientId = await lookupUserId(request, ownerCookie, CLIENT_USERNAME);
    const adminId = await lookupUserId(request, ownerCookie, ADMIN_USERNAME);

    const title = `idem-grp-${Math.random().toString(36).slice(2, 8)}`;
    const created = await request.post("/api/conversations", {
      headers: { cookie: ownerCookie },
      data: { isGroup: true, title, memberIds: [clientId, adminId] },
    });
    expect(created.status()).toBe(201);
    const conversationId: string = (await created.json()).data.id;

    // 再添加 client（已在群）→ 200 + added=0, skipped=1
    const add = await request.post(
      `/api/conversations/${conversationId}/members`,
      {
        headers: { cookie: ownerCookie },
        data: { memberIds: [clientId] },
      },
    );
    expect(add.status()).toBe(201);
    const addJson = await add.json();
    expect(addJson.data.added.length).toBe(0);
    expect(addJson.data.skipped.length).toBe(1);

    // 清理
    await request.delete(`/api/conversations/${conversationId}`, {
      headers: { cookie: ownerCookie },
    });

    await ownerCtx.close();
  });
});
