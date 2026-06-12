import { expect, test, type Page } from "@playwright/test";

import { loginAs } from "./helpers/auth";

/**
 * Stage 12.5 验收 —— SSE 实时推送 + 完整 e2e。
 *
 * 覆盖：
 *  - GET /api/realtime/stream 匿名 → 401
 *  - GET /api/realtime/stream 登录 → 200 + text/event-stream
 *  - 用户 A 在浏览器订阅 SSE；用户 B 发消息 → A 收到 message.created
 *  - 用户 B 编辑该消息 → A 收到 message.updated
 *  - 用户 B 撤回该消息 → A 收到 message.deleted
 *
 * Run: npx playwright test stage12-5
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
  if (!match) throw new Error(`lookupUserId 找不到 ${username}`);
  return match.id;
}

async function ensureDirectConversation(
  request: import("@playwright/test").APIRequestContext,
  cookie: string,
  targetUserId: string,
): Promise<string> {
  const resp = await request.post("/api/conversations", {
    headers: { cookie, "content-type": "application/json" },
    data: { isGroup: false, targetUserId },
  });
  expect([200, 201]).toContain(resp.status());
  const json = await resp.json();
  return (json?.data?.id ?? json?.id) as string;
}

interface SubscribeOptions {
  /** 等待 readyState=OPEN 的超时；默认 5s。 */
  openTimeout?: number;
}

/**
 * 在浏览器 page 里挂起一个 EventSource，事件累积到 window.__sseEvents 数组。
 * 调用方稍后通过 readEvents/expectEventKind 读取。
 */
async function subscribeRealtime(
  page: Page,
  options: SubscribeOptions = {},
): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {
      __sseEvents?: unknown[];
      __sseSource?: EventSource;
    };
    w.__sseEvents = [];
    const es = new EventSource("/api/realtime/stream");
    w.__sseSource = es;
    for (const kind of [
      "message.created",
      "message.updated",
      "message.deleted",
      "notification.created",
    ]) {
      es.addEventListener(kind, (ev: Event) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data);
          (w.__sseEvents as unknown[]).push(data);
        } catch {
          /* ignore */
        }
      });
    }
  });

  await page.waitForFunction(
    () => {
      const w = window as unknown as { __sseSource?: EventSource };
      return (
        w.__sseSource != null &&
        w.__sseSource.readyState === EventSource.OPEN
      );
    },
    { timeout: options.openTimeout ?? 5_000 },
  );
}

async function readEvents(page: Page): Promise<unknown[]> {
  return page.evaluate(() => {
    const w = window as unknown as { __sseEvents?: unknown[] };
    return w.__sseEvents ? [...w.__sseEvents] : [];
  });
}

async function closeSubscription(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __sseSource?: EventSource };
    if (w.__sseSource) {
      try {
        w.__sseSource.close();
      } catch {
        /* ignore */
      }
      w.__sseSource = undefined;
    }
  });
}

async function waitForKind(
  page: Page,
  kind: string,
  predicate: (event: Record<string, unknown>) => boolean,
  timeoutMs = 5_000,
): Promise<void> {
  await page.waitForFunction(
    ({ kind, predicateFnSrc }) => {
      const w = window as unknown as { __sseEvents?: unknown[] };
      const events = (w.__sseEvents ?? []) as Array<Record<string, unknown>>;
      const predicate = new Function(`return (${predicateFnSrc})`)() as (
        e: Record<string, unknown>,
      ) => boolean;
      return events.some((ev) => ev.kind === kind && predicate(ev));
    },
    { kind, predicateFnSrc: predicate.toString() },
    { timeout: timeoutMs },
  );
}

test.describe("Stage 12.5 · SSE realtime", () => {
  test("GET /api/realtime/stream 匿名 → 401", async ({ request }) => {
    const resp = await request.get("/api/realtime/stream");
    expect(resp.status()).toBe(401);
  });

  test("GET /api/realtime/stream 登录 → 200 + text/event-stream", async ({
    browser,
    request,
  }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAs(page, CREATOR_EMAIL);
    const cookie = await sessionCookie(page);

    // 用 raw fetch 避免 APIRequestContext 等待 body 完成（SSE 是长连接）；
    // 只读 headers 立刻 abort 即可。
    const ctrl = new AbortController();
    const resp = await fetch(
      new URL(
        "/api/realtime/stream",
        page.url() || "http://localhost:3000",
      ).toString(),
      {
        headers: { cookie, accept: "text/event-stream" },
        signal: ctrl.signal,
      },
    ).catch(() => null);

    expect(resp).not.toBeNull();
    expect(resp!.status).toBe(200);
    expect(resp!.headers.get("content-type") ?? "").toContain(
      "text/event-stream",
    );
    ctrl.abort();
    void request; // unused but kept for signature symmetry
    await ctx.close();
  });

  test("e2e: B 发消息 → A 收到 message.created（含 conversationId / senderId）", async ({
    browser,
    request,
  }) => {
    // A 是 owner，B 是 client；他们建立 1v1 会话，A 订阅 SSE。
    const ctxA = await browser.newContext();
    const pageA = await ctxA.newPage();
    await loginAs(pageA, CREATOR_EMAIL);
    const cookieA = await sessionCookie(pageA);

    const ctxB = await browser.newContext();
    const pageB = await ctxB.newPage();
    await loginAs(pageB, CLIENT_EMAIL);
    const cookieB = await sessionCookie(pageB);

    const clientId = await lookupUserId(request, cookieA, CLIENT_USERNAME);
    const conversationId = await ensureDirectConversation(
      request,
      cookieA,
      clientId,
    );

    // 必须先打开任意页面才能给 page 注入 EventSource——loginAs 已跳到 /
    await subscribeRealtime(pageA);

    // B 发消息
    const sendResp = await request.post(
      `/api/conversations/${conversationId}/messages`,
      {
        headers: { cookie: cookieB, "content-type": "application/json" },
        data: { content: `realtime ping ${Date.now()}` },
      },
    );
    expect(sendResp.status()).toBe(201);
    const sentMsgId = (await sendResp.json()).data.id as string;

    await waitForKind(
      pageA,
      "message.created",
      (ev) =>
        ev.conversationId === conversationId &&
        ev.messageId === sentMsgId,
    );

    const events = (await readEvents(pageA)) as Array<{
      kind: string;
      conversationId?: string;
      senderId?: string;
      messageType?: string;
    }>;
    const created = events.find(
      (e) => e.kind === "message.created" && e.conversationId === conversationId,
    );
    expect(created).toBeDefined();
    expect(created?.senderId).toBe(clientId);
    expect(created?.messageType).toBe("TEXT");

    // 编辑该消息 → message.updated
    const editResp = await request.patch(
      `/api/conversations/${conversationId}/messages/${sentMsgId}`,
      {
        headers: { cookie: cookieB, "content-type": "application/json" },
        data: { content: "realtime edited" },
      },
    );
    expect(editResp.status()).toBe(200);

    await waitForKind(
      pageA,
      "message.updated",
      (ev) =>
        ev.conversationId === conversationId && ev.messageId === sentMsgId,
    );

    // 撤回该消息 → message.deleted
    const delResp = await request.delete(
      `/api/conversations/${conversationId}/messages/${sentMsgId}`,
      { headers: { cookie: cookieB } },
    );
    expect(delResp.status()).toBe(200);

    await waitForKind(
      pageA,
      "message.deleted",
      (ev) =>
        ev.conversationId === conversationId && ev.messageId === sentMsgId,
    );

    await closeSubscription(pageA);
    await ctxA.close();
    await ctxB.close();
  });
});
