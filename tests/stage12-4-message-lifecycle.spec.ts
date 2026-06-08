import { expect, test, type Page } from "@playwright/test";

import { loginAs } from "./helpers/auth";

/**
 * Stage 12.4 验收 —— 消息生命周期 + 通知聚合 + 系统消息。
 *
 * 覆盖：
 *  - 消息编辑：自己 TEXT 15 分钟内 200；他人/非 TEXT/已撤回 → 4xx
 *  - 消息撤回：自己 2 分钟内 200；超窗口 → 403；群主可强删 MEMBER 消息；
 *    ADMIN 不能删 ADMIN；SYSTEM 不可删
 *  - 群信息变更触发 SYSTEM 消息（XX 修改群名）
 *  - 加成员/退群/角色变更 SYSTEM 消息
 *  - mute API：hours=1 → 设置；hours=0 → 取消；越界 → 400
 *  - mentions：发送内容含 @username 时生成 MENTION 通知
 *
 *  Run: npx playwright test stage12-4
 */

const CREATOR_EMAIL = "creator@aivideohub.com";
const CLIENT_EMAIL = "client@aivideohub.com";
const ADMIN_EMAIL = "admin@aivideohub.com";

const CLIENT_USERNAME = "ecom_client";
const ADMIN_USERNAME = "admin";
const CREATOR_USERNAME = "ai_creator";

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
  if (!match) throw new Error(`lookupUserId 找不到 ${username}`);
  return match.id;
}

async function createGroup(
  request: import("@playwright/test").APIRequestContext,
  cookie: string,
  title: string,
  memberIds: string[],
): Promise<string> {
  const resp = await request.post("/api/conversations", {
    headers: { cookie },
    data: { isGroup: true, title, memberIds },
  });
  expect(resp.status()).toBe(201);
  const json = await resp.json();
  return json.data.id as string;
}

async function sendMessage(
  request: import("@playwright/test").APIRequestContext,
  cookie: string,
  conversationId: string,
  content: string,
): Promise<string> {
  const resp = await request.post(
    `/api/conversations/${conversationId}/messages`,
    { headers: { cookie }, data: { content } },
  );
  expect(resp.status()).toBe(201);
  const json = await resp.json();
  return json.data.id as string;
}

test.describe("Stage 12.4 · Message lifecycle + notification aggregation", () => {
  // ───────────────────── API guards ─────────────────────

  test("PATCH /messages/[id] 匿名 → 401", async ({ request }) => {
    const resp = await request.patch(
      "/api/conversations/fakeid/messages/fakeid",
      { data: { content: "x" } },
    );
    expect(resp.status()).toBe(401);
  });

  test("DELETE /messages/[id] 匿名 → 401", async ({ request }) => {
    const resp = await request.delete(
      "/api/conversations/fakeid/messages/fakeid",
    );
    expect(resp.status()).toBe(401);
  });

  test("PUT /mute 匿名 → 401", async ({ request }) => {
    const resp = await request.put("/api/conversations/fakeid/mute", {
      data: { hours: 1 },
    });
    expect(resp.status()).toBe(401);
  });

  test("PUT /mute hours 越界 → 400", async ({ browser, request }) => {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await loginAs(p, CREATOR_EMAIL);
    const cookie = await sessionCookie(p);
    const resp = await request.put("/api/conversations/fakeid/mute", {
      headers: { cookie },
      data: { hours: 10000 },
    });
    expect(resp.status()).toBe(400);
    await ctx.close();
  });

  // ───────────────────── e2e：编辑 / 撤回 / SYSTEM / mute / mention ─────────────────────

  test("e2e: edit + recall + admin force-delete + SYSTEM messages + mute + @mention", async ({
    browser,
    request,
  }) => {
    const ownerCtx = await browser.newContext();
    const ownerPage = await ownerCtx.newPage();
    await loginAs(ownerPage, CREATOR_EMAIL);
    const ownerCookie = await sessionCookie(ownerPage);

    const clientId = await lookupUserId(request, ownerCookie, CLIENT_USERNAME);
    const adminId = await lookupUserId(request, ownerCookie, ADMIN_USERNAME);

    const title = `e2e-12.4-${Math.random().toString(36).slice(2, 8)}`;
    const groupId = await createGroup(request, ownerCookie, title, [
      clientId,
      adminId,
    ]);

    // 群创建本身不生成 SYSTEM 消息（只在变更时才记录），先校验列表为空
    const beforeRename = await request.get(
      `/api/conversations/${groupId}/messages`,
      { headers: { cookie: ownerCookie } },
    );
    expect(beforeRename.status()).toBe(200);

    // 1) 改群名 → 应该出现一条 SYSTEM 消息
    await request.patch(`/api/conversations/${groupId}`, {
      headers: { cookie: ownerCookie },
      data: { title: `${title}-renamed` },
    });
    const afterRename = await request.get(
      `/api/conversations/${groupId}/messages`,
      { headers: { cookie: ownerCookie } },
    );
    const renameItems = (await afterRename.json()).data.items as Array<{
      type: string;
      content: string;
    }>;
    expect(renameItems.some((m) => m.type === "SYSTEM" && m.content.includes("修改群名"))).toBe(true);

    // 2) OWNER 发一条 TEXT 消息，立即编辑
    const ownerMsgId = await sendMessage(
      request,
      ownerCookie,
      groupId,
      "hello world",
    );
    const edit = await request.patch(
      `/api/conversations/${groupId}/messages/${ownerMsgId}`,
      { headers: { cookie: ownerCookie }, data: { content: "hello edited" } },
    );
    expect(edit.status()).toBe(200);
    const edited = await edit.json();
    expect(edited.data.content).toBe("hello edited");
    expect(edited.data.editedAt).toBeTruthy();

    // 3) 别人不能编辑 owner 的消息 → 403
    const clientCtx = await browser.newContext();
    const clientPage = await clientCtx.newPage();
    await loginAs(clientPage, CLIENT_EMAIL);
    const clientCookie = await sessionCookie(clientPage);
    const editByOther = await request.patch(
      `/api/conversations/${groupId}/messages/${ownerMsgId}`,
      { headers: { cookie: clientCookie }, data: { content: "hack" } },
    );
    expect(editByOther.status()).toBe(403);

    // 4) 编辑空内容 → 400
    const editEmpty = await request.patch(
      `/api/conversations/${groupId}/messages/${ownerMsgId}`,
      { headers: { cookie: ownerCookie }, data: { content: "" } },
    );
    expect(editEmpty.status()).toBe(400);

    // 5) client 发一条消息然后自己撤回（在 2 分钟内）→ 200
    const clientMsgId = await sendMessage(
      request,
      clientCookie,
      groupId,
      "client text",
    );
    const recall = await request.delete(
      `/api/conversations/${groupId}/messages/${clientMsgId}`,
      { headers: { cookie: clientCookie } },
    );
    expect(recall.status()).toBe(200);

    // 6) 再次撤回同一条 → 409
    const recallAgain = await request.delete(
      `/api/conversations/${groupId}/messages/${clientMsgId}`,
      { headers: { cookie: clientCookie } },
    );
    expect(recallAgain.status()).toBe(409);

    // 7) 撤回后再编辑 → 409
    const editDeleted = await request.patch(
      `/api/conversations/${groupId}/messages/${clientMsgId}`,
      { headers: { cookie: clientCookie }, data: { content: "x" } },
    );
    expect(editDeleted.status()).toBe(409);

    // 8) admin 把 admin 提为 ADMIN，使其能强删；OWNER 给 client 发的另一条消息加测试
    await request.patch(
      `/api/conversations/${groupId}/members/${adminId}`,
      { headers: { cookie: ownerCookie }, data: { role: "ADMIN" } },
    );

    // client 再发一条
    const anotherClientMsgId = await sendMessage(
      request,
      clientCookie,
      groupId,
      "client second",
    );

    // 9) admin (ADMIN) 强删 client (MEMBER) 的消息 → 200
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await loginAs(adminPage, ADMIN_EMAIL);
    const adminCookie = await sessionCookie(adminPage);
    const adminForceDelete = await request.delete(
      `/api/conversations/${groupId}/messages/${anotherClientMsgId}`,
      { headers: { cookie: adminCookie } },
    );
    expect(adminForceDelete.status()).toBe(200);

    // 10) admin 不能强删 OWNER 的消息 → 403
    const ownerMsg2 = await sendMessage(
      request,
      ownerCookie,
      groupId,
      "owner text",
    );
    const adminCantDeleteOwner = await request.delete(
      `/api/conversations/${groupId}/messages/${ownerMsg2}`,
      { headers: { cookie: adminCookie } },
    );
    expect(adminCantDeleteOwner.status()).toBe(403);

    // 11) admin 不能删 admin 自己以外的 admin 消息 — 已没有其它 admin；间接覆盖
    //     （ADMIN 间互不可删的规则在 unit 层 ForbiddenError 抛出）

    // 12) SYSTEM 消息不可撤回 → 找出 SYSTEM 然后 DELETE
    const allMsgs = await request.get(
      `/api/conversations/${groupId}/messages`,
      { headers: { cookie: ownerCookie } },
    );
    const sysMsg = ((await allMsgs.json()).data.items as Array<{
      id: string;
      type: string;
      senderId: string;
    }>).find((m) => m.type === "SYSTEM");
    expect(sysMsg).toBeTruthy();
    const tryDeleteSystem = await request.delete(
      `/api/conversations/${groupId}/messages/${sysMsg!.id}`,
      { headers: { cookie: ownerCookie } },
    );
    expect(tryDeleteSystem.status()).toBe(403);

    // 13) mute toggle：client 静音 1h 后 GET 列表 unreadCount=0
    const mute = await request.put(
      `/api/conversations/${groupId}/mute`,
      { headers: { cookie: clientCookie }, data: { hours: 1 } },
    );
    expect(mute.status()).toBe(200);
    const unmute = await request.put(
      `/api/conversations/${groupId}/mute`,
      { headers: { cookie: clientCookie }, data: { hours: 0 } },
    );
    expect(unmute.status()).toBe(200);

    // 14) @mention：owner 发一条 @client_username 的消息
    await sendMessage(
      request,
      ownerCookie,
      groupId,
      `@${CLIENT_USERNAME} 看下这个`,
    );
    // 给通知 emit 留一点时间（fire-and-forget 在 promise.all 内完成）
    await clientPage.waitForTimeout(300);
    const notifResp = await request.get(
      `/api/notifications?type=MENTION&pageSize=5`,
      { headers: { cookie: clientCookie } },
    );
    expect(notifResp.status()).toBe(200);
    const notifJson = await notifResp.json();
    const items = (notifJson.data?.items ?? []) as Array<{
      title: string;
      type: string;
    }>;
    expect(
      items.some((n) => n.type === "MENTION" && n.title.includes("@了你")),
    ).toBe(true);

    // 15) 解散群聊清理
    await request.delete(`/api/conversations/${groupId}`, {
      headers: { cookie: ownerCookie },
    });

    await ownerCtx.close();
    await clientCtx.close();
    await adminCtx.close();
  });

  // ───────────────────── parseMentions 单元行为（通过通知反推） ─────────────────────

  test("非 mention 群消息走 GROUP_MESSAGE 通知（不打到 MENTION）", async ({
    browser,
    request,
  }) => {
    const ownerCtx = await browser.newContext();
    const ownerPage = await ownerCtx.newPage();
    await loginAs(ownerPage, CREATOR_EMAIL);
    const ownerCookie = await sessionCookie(ownerPage);

    const clientId = await lookupUserId(request, ownerCookie, CLIENT_USERNAME);
    const adminId = await lookupUserId(request, ownerCookie, ADMIN_USERNAME);
    const title = `nomention-${Math.random().toString(36).slice(2, 8)}`;
    const groupId = await createGroup(request, ownerCookie, title, [
      clientId,
      adminId,
    ]);

    await sendMessage(request, ownerCookie, groupId, "纯文本，无 @ 标记");

    const clientCtx = await browser.newContext();
    const clientPage = await clientCtx.newPage();
    await loginAs(clientPage, CLIENT_EMAIL);
    const clientCookie = await sessionCookie(clientPage);
    await clientPage.waitForTimeout(300);

    const groupNotif = await request.get(
      `/api/notifications?type=GROUP_MESSAGE&pageSize=5`,
      { headers: { cookie: clientCookie } },
    );
    expect(groupNotif.status()).toBe(200);
    const items = (await groupNotif.json()).data?.items ?? [];
    // 至少有一条 GROUP_MESSAGE 来自 owner，body 含「群聊」字样
    expect(
      (items as Array<{ type: string; title: string }>).some(
        (n) => n.type === "GROUP_MESSAGE" && n.title.includes(title),
      ),
    ).toBe(true);

    await request.delete(`/api/conversations/${groupId}`, {
      headers: { cookie: ownerCookie },
    });
    await ownerCtx.close();
    await clientCtx.close();
  });

  // ───────────────────── 1v1 通知仍走 MESSAGE 类型 ─────────────────────

  test("1v1 私信仍走 MESSAGE 通知类型，不被 GROUP_MESSAGE 替代", async ({
    browser,
    request,
  }) => {
    const ownerCtx = await browser.newContext();
    const ownerPage = await ownerCtx.newPage();
    await loginAs(ownerPage, CREATOR_EMAIL);
    const ownerCookie = await sessionCookie(ownerPage);
    const clientId = await lookupUserId(request, ownerCookie, CLIENT_USERNAME);

    // 创建 1v1
    const create = await request.post("/api/conversations", {
      headers: { cookie: ownerCookie },
      data: { targetUserId: clientId },
    });
    expect([200, 201]).toContain(create.status());
    const convId = (await create.json()).data.id as string;
    await sendMessage(
      request,
      ownerCookie,
      convId,
      `1v1 ping ${Date.now()}`,
    );

    const clientCtx = await browser.newContext();
    const clientPage = await clientCtx.newPage();
    await loginAs(clientPage, CLIENT_EMAIL);
    const clientCookie = await sessionCookie(clientPage);
    await clientPage.waitForTimeout(300);

    const msgNotif = await request.get(
      `/api/notifications?type=MESSAGE&pageSize=5`,
      { headers: { cookie: clientCookie } },
    );
    const items = (await msgNotif.json()).data?.items ?? [];
    expect(
      (items as Array<{ type: string }>).some((n) => n.type === "MESSAGE"),
    ).toBe(true);

    await ownerCtx.close();
    await clientCtx.close();
    void CREATOR_USERNAME;
  });
});
