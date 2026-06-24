import { expect, test } from "@playwright/test";

import { loginAs } from "./helpers/auth";

/**
 * Stage 17.3 验收 —— 发布期关键词黑名单。
 *
 * 覆盖：
 *  1. API guards：admin CRUD 的 401/403
 *  2. admin CRUD round-trip：POST → GET 列表能看到 → PATCH severity → DELETE
 *  3. POST scope：BLOCK 词命中 → /api/posts 创建被拒（400 + blockedKeywords）
 *  4. COMMENT scope：BLOCK 词命中 → /api/posts/[id]/comments 被拒
 *  5. ALL scope：跨多种 surface 都拦截
 *  6. WARN scope：不拦截，但创建审计行
 *
 * Run: npx playwright test stage17-3
 */

// Admin CRUD + cross-surface 触及多个 first-hit 编译；放宽到 60s。
test.describe.configure({ timeout: 60_000 });

const ADMIN_EMAIL = "admin@aivideohub.com";
const AUTHOR_EMAIL = "anim@seedland.dev";

// 测试用关键词带唯一前缀，避免污染或与现网真实词冲突。
const PFX = `t17_3_${Math.random().toString(36).slice(2, 8)}`;
const POST_BLOCK_WORD = `${PFX}_postblock`;
const COMMENT_BLOCK_WORD = `${PFX}_commentblock`;
const ALL_BLOCK_WORD = `${PFX}_allblock`;
const WARN_WORD = `${PFX}_warn`;

async function getFirstChannelId(
  request: import("@playwright/test").APIRequestContext,
): Promise<string> {
  const resp = await request.get("/api/posts?pageSize=1");
  const body = await resp.json();
  const channelId = body?.data?.items?.[0]?.channel?.id as string | undefined;
  expect(channelId, "seed 数据应至少有一条 post 提供 channelId").toBeTruthy();
  return channelId!;
}

async function createBlockedWord(
  request: import("@playwright/test").APIRequestContext,
  pattern: string,
  scope: string,
  severity: "BLOCK" | "WARN" = "BLOCK",
): Promise<string> {
  const resp = await request.post("/api/admin/blocked-words", {
    data: { pattern, scope, severity, note: `stage17-3 spec ${PFX}` },
    failOnStatusCode: false,
  });
  expect(
    resp.status(),
    `create blocked word "${pattern}" should 201: got ${resp.status()}`,
  ).toBe(201);
  const body = await resp.json();
  return body.data.id as string;
}

async function deleteBlockedWord(
  request: import("@playwright/test").APIRequestContext,
  id: string,
): Promise<void> {
  await request.delete(`/api/admin/blocked-words/${id}`, {
    failOnStatusCode: false,
  });
}

test.describe("Stage 17.3 · 发布期关键词黑名单", () => {
  test("API guards：admin CRUD 401 / 403", async ({ request, browser }) => {
    // 匿名 GET → 401
    const anonGet = await request.get("/api/admin/blocked-words", {
      failOnStatusCode: false,
    });
    expect(anonGet.status()).toBe(401);

    // 匿名 POST → 401
    const anonPost = await request.post("/api/admin/blocked-words", {
      data: { pattern: "x".repeat(3), severity: "BLOCK", scope: "ALL" },
      failOnStatusCode: false,
    });
    expect(anonPost.status()).toBe(401);

    // 普通用户 GET → 403
    const userCtx = await browser.newContext();
    const userPage = await userCtx.newPage();
    await loginAs(userPage, AUTHOR_EMAIL);
    const userGet = await userPage.request.get("/api/admin/blocked-words", {
      failOnStatusCode: false,
    });
    expect(userGet.status()).toBe(403);
    await userCtx.close();
  });

  test("admin CRUD round-trip + 60s 缓存内即时生效", async ({ browser }) => {
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await loginAs(adminPage, ADMIN_EMAIL);

    // 创建 + 立刻搜索能命中
    const id = await createBlockedWord(
      adminPage.request,
      `${PFX}_crud`,
      "ALL",
      "BLOCK",
    );
    const listResp = await adminPage.request.get(
      `/api/admin/blocked-words?q=${PFX}_crud`,
    );
    const listBody = await listResp.json();
    expect(listBody.data.items.find((w: { id: string }) => w.id === id)).toBeTruthy();

    // PATCH severity → WARN
    const patch = await adminPage.request.patch(
      `/api/admin/blocked-words/${id}`,
      {
        data: { severity: "WARN" },
      },
    );
    expect(patch.ok()).toBeTruthy();
    const updated = await patch.json();
    expect(updated.data.severity).toBe("WARN");

    // 创建重复 pattern → 400
    const dup = await adminPage.request.post("/api/admin/blocked-words", {
      data: {
        pattern: `${PFX}_crud`,
        severity: "BLOCK",
        scope: "ALL",
      },
      failOnStatusCode: false,
    });
    expect(dup.status()).toBe(400);

    // DELETE
    await deleteBlockedWord(adminPage.request, id);
    const after = await adminPage.request.get(
      `/api/admin/blocked-words?q=${PFX}_crud`,
    );
    const afterBody = await after.json();
    expect(afterBody.data.items.find((w: { id: string }) => w.id === id)).toBeFalsy();

    await adminCtx.close();
  });

  test("POST scope BLOCK：/api/posts 被拒带 blockedKeywords", async ({
    browser,
  }) => {
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await loginAs(adminPage, ADMIN_EMAIL);
    const wordId = await createBlockedWord(
      adminPage.request,
      POST_BLOCK_WORD,
      "POST",
      "BLOCK",
    );

    const authorCtx = await browser.newContext();
    const authorPage = await authorCtx.newPage();
    await loginAs(authorPage, AUTHOR_EMAIL);
    const channelId = await getFirstChannelId(authorPage.request);

    // 含 BLOCK 词 → 400
    const blocked = await authorPage.request.post("/api/posts", {
      data: {
        channelId,
        title: `合法标题 ${PFX}`,
        content: `这是一段包含违禁词 ${POST_BLOCK_WORD.toUpperCase()} 的内容（注意大写仍命中）。`,
        type: "DISCUSSION",
      },
      failOnStatusCode: false,
    });
    expect(blocked.status()).toBe(400);
    const blockedBody = await blocked.json();
    expect(blockedBody.error?.details?.blockedKeywords).toContain(
      POST_BLOCK_WORD,
    );

    // 不含词 → 201
    const ok = await authorPage.request.post("/api/posts", {
      data: {
        channelId,
        title: `Stage 17.3 正常帖 ${PFX}`,
        content: "本帖不含任何违禁词，应该能正常创建。",
        type: "DISCUSSION",
      },
      failOnStatusCode: false,
    });
    expect(ok.status()).toBe(201);
    const okBody = await ok.json();
    const newPostId = okBody.data.id as string;

    // 清理
    await authorPage.request.delete(`/api/posts/${newPostId}`, {
      failOnStatusCode: false,
    });
    await deleteBlockedWord(adminPage.request, wordId);
    await authorCtx.close();
    await adminCtx.close();
  });

  test("COMMENT scope BLOCK：仅评论被拒，发帖正常", async ({ browser }) => {
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await loginAs(adminPage, ADMIN_EMAIL);
    const wordId = await createBlockedWord(
      adminPage.request,
      COMMENT_BLOCK_WORD,
      "COMMENT",
      "BLOCK",
    );

    const authorCtx = await browser.newContext();
    const authorPage = await authorCtx.newPage();
    await loginAs(authorPage, AUTHOR_EMAIL);
    const channelId = await getFirstChannelId(authorPage.request);

    // 发帖（含 COMMENT-only 词）应正常 —— scope 不匹配
    const post = await authorPage.request.post("/api/posts", {
      data: {
        channelId,
        title: `测试帖 ${PFX}`,
        content: `这帖标题里就含 ${COMMENT_BLOCK_WORD}，但 scope=COMMENT 不会拦帖子。`,
        type: "DISCUSSION",
      },
      failOnStatusCode: false,
    });
    expect(post.status()).toBe(201);
    const postId = (await post.json()).data.id as string;

    // 评论含词 → 400
    const blocked = await authorPage.request.post(
      `/api/posts/${postId}/comments`,
      {
        data: {
          content: `这是一条含 ${COMMENT_BLOCK_WORD} 的评论，应被拦截。`,
        },
        failOnStatusCode: false,
      },
    );
    expect(blocked.status()).toBe(400);

    // 评论不含词 → 201
    const ok = await authorPage.request.post(
      `/api/posts/${postId}/comments`,
      {
        data: { content: "本评论内容合规，应当成功。" },
        failOnStatusCode: false,
      },
    );
    expect(ok.status()).toBe(201);

    // 清理
    await authorPage.request.delete(`/api/posts/${postId}`, {
      failOnStatusCode: false,
    });
    await deleteBlockedWord(adminPage.request, wordId);
    await authorCtx.close();
    await adminCtx.close();
  });

  test("ALL scope BLOCK：跨多个 surface 都拦截", async ({ browser }) => {
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await loginAs(adminPage, ADMIN_EMAIL);
    const wordId = await createBlockedWord(
      adminPage.request,
      ALL_BLOCK_WORD,
      "ALL",
      "BLOCK",
    );

    const authorCtx = await browser.newContext();
    const authorPage = await authorCtx.newPage();
    await loginAs(authorPage, AUTHOR_EMAIL);
    const channelId = await getFirstChannelId(authorPage.request);

    // 发帖被拒
    const postBlocked = await authorPage.request.post("/api/posts", {
      data: {
        channelId,
        title: `Stage 17.3 测试 ${PFX}`,
        content: `内容含 ${ALL_BLOCK_WORD}，应拒。`,
        type: "DISCUSSION",
      },
      failOnStatusCode: false,
    });
    expect(postBlocked.status()).toBe(400);

    // 合作需求被拒
    const collabBlocked = await authorPage.request.post(
      "/api/collaborations",
      {
        data: {
          category: "AI_VIDEO_TEAM",
          type: "LOOKING_FOR",
          workMode: "PROJECT",
          location: "REMOTE",
          title: `Stage 17.3 合作 ${PFX}`,
          description: `本合作描述含 ${ALL_BLOCK_WORD}，应拒。`,
          tags: ["t17-3"],
          contact: "@test",
        },
        failOnStatusCode: false,
      },
    );
    expect(collabBlocked.status()).toBe(400);

    // 清理
    await deleteBlockedWord(adminPage.request, wordId);
    await authorCtx.close();
    await adminCtx.close();
  });

  test("WARN severity：不阻塞但落审计", async ({ browser }) => {
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await loginAs(adminPage, ADMIN_EMAIL);
    const wordId = await createBlockedWord(
      adminPage.request,
      WARN_WORD,
      "POST",
      "WARN",
    );

    const authorCtx = await browser.newContext();
    const authorPage = await authorCtx.newPage();
    await loginAs(authorPage, AUTHOR_EMAIL);
    const channelId = await getFirstChannelId(authorPage.request);

    const ok = await authorPage.request.post("/api/posts", {
      data: {
        channelId,
        title: `WARN 测试 ${PFX}`,
        content: `内容含 ${WARN_WORD}，应当允许但产生审计。`,
        type: "DISCUSSION",
      },
      failOnStatusCode: false,
    });
    expect(
      ok.status(),
      `WARN scope should not block creation: got ${ok.status()}`,
    ).toBe(201);
    const newPostId = (await ok.json()).data.id as string;

    // 清理
    await authorPage.request.delete(`/api/posts/${newPostId}`, {
      failOnStatusCode: false,
    });
    await deleteBlockedWord(adminPage.request, wordId);
    await authorCtx.close();
    await adminCtx.close();
  });
});
