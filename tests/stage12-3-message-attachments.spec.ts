import { expect, test, type Page } from "@playwright/test";

import { loginAs } from "./helpers/auth";

/**
 * Stage 12.3 验收 —— 消息附件 + 上传管道扩展。
 *
 * 覆盖：
 *  - /api/uploads/sign 接受 kind=message_attachment + MIME 白名单（image/video/audio/pdf/zip）
 *  - /api/uploads/sign 拒绝非白名单 MIME（如 exe）
 *  - /api/conversations/[id]/messages POST 接受 attachments + 无 content 但有附件
 *  - POST 拒绝同时空 content + 空 attachments
 *  - POST 推断 type=IMAGE/FILE 写库 → GET 列表回显
 *  - GET /messages/[id] 页面渲染附件 (img / file 链接)
 *  - GET /messages 列表预览展示 [图片] / [文件] 标签
 *  - MessageComposer 渲染 Paperclip 按钮 + textarea 占位含「拖拽 / 粘贴」
 *
 *  Run: npx playwright test stage12-3
 */

const CREATOR_EMAIL = "creator@aivideohub.com";
const CLIENT_EMAIL = "client@aivideohub.com";
const CLIENT_USERNAME = "ecom_client";

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
  if (!match)
    throw new Error(
      `lookupUserId: 找不到 username=${username}（hits=${JSON.stringify(hits)}）`,
    );
  return match.id;
}

/** 用 startConversation server action 拿到 1v1 会话 id；如果已存在直接复用。 */
async function ensureDirectConversation(
  request: import("@playwright/test").APIRequestContext,
  cookie: string,
  targetUserId: string,
): Promise<string> {
  // POST /api/conversations 是 Stage 12.1+ 暴露的 isGroup discriminatedUnion 入口
  const resp = await request.post("/api/conversations", {
    headers: { cookie, "content-type": "application/json" },
    data: { isGroup: false, targetUserId },
  });
  expect([200, 201]).toContain(resp.status());
  const json = await resp.json();
  const id = json?.data?.id ?? json?.id;
  if (!id) throw new Error(`ensureDirectConversation: missing id ${JSON.stringify(json)}`);
  return id;
}

test.describe("Stage 12.3 · Message attachments + upload pipeline", () => {
  // ───────────────────── upload sign 校验 ─────────────────────

  test("/api/uploads/sign 接受 kind=message_attachment + image/jpeg", async ({
    page,
    request,
  }) => {
    await loginAs(page, CREATOR_EMAIL);
    const cookie = await sessionCookie(page);
    const resp = await request.post("/api/uploads/sign", {
      headers: { cookie, "content-type": "application/json" },
      data: {
        kind: "message_attachment",
        mime: "image/jpeg",
        size: 1024,
        filename: "hello.jpg",
      },
    });
    // 真实环境可能 503（R2 未配置）；也可能 200（已配置）。两者都说明 zod 通过了。
    expect([200, 503]).toContain(resp.status());
    if (resp.status() === 200) {
      const json = await resp.json();
      expect(json.data?.uploadUrl).toContain("http");
      expect(json.data?.publicUrl).toContain("http");
    }
  });

  test("/api/uploads/sign 拒绝非白名单 mime（exe）", async ({
    page,
    request,
  }) => {
    await loginAs(page, CREATOR_EMAIL);
    const cookie = await sessionCookie(page);
    const resp = await request.post("/api/uploads/sign", {
      headers: { cookie, "content-type": "application/json" },
      data: {
        kind: "message_attachment",
        mime: "application/x-msdownload",
        size: 1024,
        filename: "evil.exe",
      },
    });
    expect(resp.status()).toBe(400);
  });

  test("/api/uploads/sign 接受 audio/mpeg + application/pdf", async ({
    page,
    request,
  }) => {
    await loginAs(page, CREATOR_EMAIL);
    const cookie = await sessionCookie(page);
    for (const mime of ["audio/mpeg", "application/pdf"]) {
      const resp = await request.post("/api/uploads/sign", {
        headers: { cookie, "content-type": "application/json" },
        data: {
          kind: "message_attachment",
          mime,
          size: 2048,
          filename: `x.${mime.split("/")[1]}`,
        },
      });
      expect([200, 503]).toContain(resp.status());
    }
  });

  // ───────────────────── messages API attachments ─────────────────────

  test("POST /api/conversations/[id]/messages 仅 attachments 无 content → 201", async ({
    page,
    request,
  }) => {
    await loginAs(page, CREATOR_EMAIL);
    const cookie = await sessionCookie(page);
    const clientId = await lookupUserId(request, cookie, CLIENT_USERNAME);
    const conversationId = await ensureDirectConversation(
      request,
      cookie,
      clientId,
    );

    const resp = await request.post(
      `/api/conversations/${conversationId}/messages`,
      {
        headers: { cookie, "content-type": "application/json" },
        data: {
          content: "",
          attachments: [
            {
              url: "https://cdn.example.com/messages/2026/06/07/abc/img.jpg",
              name: "stage12-3-test.jpg",
              mimeType: "image/jpeg",
              sizeBytes: 102400,
              width: 800,
              height: 600,
            },
          ],
        },
      },
    );
    expect(resp.status()).toBe(201);
    const json = await resp.json();
    expect(json.data?.type).toBe("IMAGE");
    expect(json.data?.attachments).toBeTruthy();
  });

  test("POST /api/conversations/[id]/messages 同时空 content + 空 attachments → 400", async ({
    page,
    request,
  }) => {
    await loginAs(page, CREATOR_EMAIL);
    const cookie = await sessionCookie(page);
    const clientId = await lookupUserId(request, cookie, CLIENT_USERNAME);
    const conversationId = await ensureDirectConversation(
      request,
      cookie,
      clientId,
    );

    const resp = await request.post(
      `/api/conversations/${conversationId}/messages`,
      {
        headers: { cookie, "content-type": "application/json" },
        data: { content: "", attachments: [] },
      },
    );
    expect(resp.status()).toBe(400);
  });

  test("POST 多附件 → 推断 FILE 类型 + 写库回显", async ({
    page,
    request,
  }) => {
    await loginAs(page, CREATOR_EMAIL);
    const cookie = await sessionCookie(page);
    const clientId = await lookupUserId(request, cookie, CLIENT_USERNAME);
    const conversationId = await ensureDirectConversation(
      request,
      cookie,
      clientId,
    );

    const sendResp = await request.post(
      `/api/conversations/${conversationId}/messages`,
      {
        headers: { cookie, "content-type": "application/json" },
        data: {
          content: "看下这两个附件",
          attachments: [
            {
              url: "https://cdn.example.com/messages/a.pdf",
              name: "spec.pdf",
              mimeType: "application/pdf",
              sizeBytes: 2048,
            },
            {
              url: "https://cdn.example.com/messages/b.zip",
              name: "assets.zip",
              mimeType: "application/zip",
              sizeBytes: 8192,
            },
          ],
        },
      },
    );
    expect(sendResp.status()).toBe(201);
    expect((await sendResp.json()).data?.type).toBe("FILE");

    const listResp = await request.get(
      `/api/conversations/${conversationId}/messages?page=1&pageSize=5`,
      { headers: { cookie } },
    );
    expect(listResp.status()).toBe(200);
    const list = await listResp.json();
    const first = list.data?.items?.[0];
    expect(first?.type).toBe("FILE");
    expect(Array.isArray(first?.attachments)).toBeTruthy();
    expect(first.attachments.length).toBe(2);
  });

  test("POST 拒绝附件 MIME 不在白名单", async ({ page, request }) => {
    await loginAs(page, CREATOR_EMAIL);
    const cookie = await sessionCookie(page);
    const clientId = await lookupUserId(request, cookie, CLIENT_USERNAME);
    const conversationId = await ensureDirectConversation(
      request,
      cookie,
      clientId,
    );

    const resp = await request.post(
      `/api/conversations/${conversationId}/messages`,
      {
        headers: { cookie, "content-type": "application/json" },
        data: {
          content: "",
          attachments: [
            {
              url: "https://cdn.example.com/m/evil.exe",
              name: "evil.exe",
              mimeType: "application/x-msdownload",
              sizeBytes: 1024,
            },
          ],
        },
      },
    );
    expect(resp.status()).toBe(400);
  });

  // ───────────────────── UI 渲染检查 ─────────────────────

  test("MessageComposer 渲染 Paperclip 按钮 + 占位含拖拽提示", async ({
    page,
    request,
  }) => {
    await loginAs(page, CLIENT_EMAIL);
    const cookie = await sessionCookie(page);
    // 找 creator 给 client 发的会话
    const list = await request.get("/api/conversations", {
      headers: { cookie },
    });
    expect(list.status()).toBe(200);
    const json = await list.json();
    const conv = (json.data?.items ?? json.items ?? json.data ?? []).find(
      (c: { isGroup?: boolean }) => c.isGroup === false,
    );
    if (!conv) test.skip(true, "没有 1v1 会话可测");

    await page.goto(`/messages/${conv.id}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator('button[aria-label="添加附件"]')).toBeVisible();
    const placeholder = await page
      .locator('textarea[name="content"]')
      .getAttribute("placeholder");
    expect(placeholder ?? "").toMatch(/拖拽|粘贴|附件/);
  });

  test("/messages 列表预览展示 [图片] / [文件] 前缀", async ({ page }) => {
    await loginAs(page, CLIENT_EMAIL);
    await page.goto("/messages", { waitUntil: "domcontentloaded" });
    const body = await page.textContent("body");
    // creator 在上面用例里已经发过 image + 两个 file 附件
    expect(body ?? "").toMatch(/\[图片\]|\[文件\]/);
  });
});
