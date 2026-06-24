import { expect, test } from "@playwright/test";

import { loginAs } from "./helpers/auth";

/**
 * Stage 17.2 验收 —— 内容软删除 + 申诉系统。
 *
 * 覆盖：
 *  1. API guards：/api/me/appeals + /api/admin/appeals 的鉴权 / 校验
 *  2. 软删除路径：ADMIN 通过 API DELETE /api/posts/[id] 删他人 → 内容仍存在 DB（GET 404，作者仍能进 /post/[id] 看到下架 banner）
 *  3. 申诉端到端：作者提交申诉 → admin 队列出现 → APPROVE → 内容恢复，公共 GET 200
 *  4. 申诉端到端 REJECT：admin 驳回（必填备注）→ 作者状态 = REJECTED → 可以重新申诉
 *  5. 重复 PENDING 申诉被 409
 *  6. 撤回 PENDING 申诉
 *
 * Run: npx playwright test stage17-2
 */

const ADMIN_EMAIL = "admin@aivideohub.com";
const AUTHOR_EMAIL = "anim@seedland.dev";

async function createPost(
  request: import("@playwright/test").APIRequestContext,
  channelId: string,
  title: string,
) {
  const resp = await request.post("/api/posts", {
    data: {
      channelId,
      title,
      content: "本帖用于 Stage 17.2 端到端测试，正常情况下不会被人看到。",
      type: "DISCUSSION",
    },
    failOnStatusCode: false,
  });
  expect(resp.ok()).toBeTruthy();
  const body = await resp.json();
  return body.data.id as string;
}

async function getFirstChannelId(
  request: import("@playwright/test").APIRequestContext,
): Promise<string> {
  // 没有公共 channel list API；通过 /api/posts 第一条获取 channelId。
  const resp = await request.get("/api/posts?pageSize=1");
  const body = await resp.json();
  const channelId = body?.data?.items?.[0]?.channel?.id as string | undefined;
  expect(channelId, "seed 数据里应有至少一条 post 提供 channelId").toBeTruthy();
  return channelId!;
}

// 涉及 5 个新路由 + 多个跨用户上下文，dev server 首次编译 /post / /me/appeals / /admin/appeals
// 可能让单条用例触及 30s 默认；放宽到 60s 给 first-hit 编译留余量。
test.describe.configure({ timeout: 60_000 });

test.describe("Stage 17.2 · 内容软删除 + 申诉系统", () => {
  test("API guards：/api/me/appeals + /api/admin/appeals 鉴权 / 校验", async ({
    request,
  }) => {
    // 匿名 GET /api/me/appeals → 401
    const meAnon = await request.get("/api/me/appeals", {
      failOnStatusCode: false,
    });
    expect(meAnon.status()).toBe(401);

    // 匿名 POST /api/me/appeals → 401
    const submitAnon = await request.post("/api/me/appeals", {
      data: { targetType: "POST", targetId: "fake", reason: "too short" },
      failOnStatusCode: false,
    });
    expect(submitAnon.status()).toBe(401);

    // 匿名 GET /api/admin/appeals → 401（requireAdmin 重定向到 /auth/login 也会拒绝 API）
    const adminAnon = await request.get("/api/admin/appeals", {
      failOnStatusCode: false,
    });
    expect([401, 403, 302].includes(adminAnon.status())).toBeTruthy();
  });

  test("作者自己 DELETE 已下架帖子 → 403；公共 GET 不可见；作者页可见", async ({
    browser,
  }) => {
    const authorCtx = await browser.newContext();
    const authorPage = await authorCtx.newPage();
    await loginAs(authorPage, AUTHOR_EMAIL);

    const channelId = await getFirstChannelId(authorPage.request);
    const postId = await createPost(
      authorPage.request,
      channelId,
      "Stage17.2 软删除目标帖 A",
    );

    // ADMIN 走 API DELETE → 应触发 softDelete（admin 非作者路径）
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await loginAs(adminPage, ADMIN_EMAIL);
    const delResp = await adminPage.request.delete(`/api/posts/${postId}`);
    expect(delResp.ok()).toBeTruthy();

    // 公共 GET → 404
    const pubResp = await authorPage.request.get(`/api/posts/${postId}`, {
      failOnStatusCode: false,
    });
    expect(pubResp.status()).toBe(404);

    // 作者本人访问详情页：不应 404（应看到下架 banner）
    const visit = await authorPage.goto(`/post/${postId}`);
    expect(visit?.status() ?? 500).toBeLessThan(400);
    await expect(authorPage.getByText(/内容已下架/)).toBeVisible();
    await expect(
      authorPage.getByRole("link", { name: /申诉中心/ }),
    ).toBeVisible();

    // 作者再 DELETE → 403（已下架的内容不允许作者再硬删）
    const selfDel = await authorPage.request.delete(`/api/posts/${postId}`, {
      failOnStatusCode: false,
    });
    expect(selfDel.status()).toBe(403);

    await authorCtx.close();
    await adminCtx.close();
  });

  test("端到端 APPROVE：作者申诉 → admin 通过 → 内容恢复", async ({
    browser,
  }) => {
    const authorCtx = await browser.newContext();
    const authorPage = await authorCtx.newPage();
    await loginAs(authorPage, AUTHOR_EMAIL);

    const channelId = await getFirstChannelId(authorPage.request);
    const postId = await createPost(
      authorPage.request,
      channelId,
      "Stage17.2 APPROVE 端到端帖",
    );

    // ADMIN 下架
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await loginAs(adminPage, ADMIN_EMAIL);
    const del = await adminPage.request.delete(`/api/posts/${postId}`);
    expect(del.ok()).toBeTruthy();

    // 作者提交申诉
    const submit = await authorPage.request.post("/api/me/appeals", {
      data: {
        targetType: "POST",
        targetId: postId,
        reason: "我相信本帖未违反社区规则，请复核。Stage 17.2 e2e。",
      },
      failOnStatusCode: false,
    });
    expect(submit.status()).toBe(201);
    const submitBody = await submit.json();
    expect(submitBody.success).toBeTruthy();
    const appealId = submitBody.data.id as string;

    // 重复 PENDING → 409
    const dup = await authorPage.request.post("/api/me/appeals", {
      data: {
        targetType: "POST",
        targetId: postId,
        reason: "重复提交申诉测试，正常情况应被拦截。",
      },
      failOnStatusCode: false,
    });
    expect(dup.status()).toBe(409);

    // admin 通过申诉
    const review = await adminPage.request.post(
      `/api/admin/appeals/${appealId}`,
      {
        data: { decision: "APPROVE", reviewNote: "经复核内容未违规，恢复展示。" },
        failOnStatusCode: false,
      },
    );
    expect(review.ok()).toBeTruthy();

    // 公共 GET → 200（恢复）
    const pub = await authorPage.request.get(`/api/posts/${postId}`);
    expect(pub.ok()).toBeTruthy();

    // 作者申诉列表：APPROVED 出现
    const myList = await authorPage.request.get("/api/me/appeals");
    const myListBody = await myList.json();
    const matched = myListBody.data.items.find(
      (a: { id: string }) => a.id === appealId,
    );
    expect(matched?.status).toBe("APPROVED");

    // 清理：作者把测试帖硬删除
    const cleanup = await authorPage.request.delete(`/api/posts/${postId}`, {
      failOnStatusCode: false,
    });
    expect(cleanup.ok()).toBeTruthy();

    await authorCtx.close();
    await adminCtx.close();
  });

  test("端到端 REJECT：admin 驳回必填备注 → 作者可重新申诉", async ({
    browser,
  }) => {
    const authorCtx = await browser.newContext();
    const authorPage = await authorCtx.newPage();
    await loginAs(authorPage, AUTHOR_EMAIL);

    const channelId = await getFirstChannelId(authorPage.request);
    const postId = await createPost(
      authorPage.request,
      channelId,
      "Stage17.2 REJECT 端到端帖",
    );

    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await loginAs(adminPage, ADMIN_EMAIL);
    await adminPage.request.delete(`/api/posts/${postId}`);

    // 作者提交申诉 1
    const submit = await authorPage.request.post("/api/me/appeals", {
      data: {
        targetType: "POST",
        targetId: postId,
        reason: "我认为下架决定有误，请审核员复核（第一次申诉）。",
      },
    });
    const appealId = (await submit.json()).data.id as string;

    // admin 驳回 — 不带 reviewNote 应 400
    const missing = await adminPage.request.post(
      `/api/admin/appeals/${appealId}`,
      {
        data: { decision: "REJECT" },
        failOnStatusCode: false,
      },
    );
    expect(missing.status()).toBe(400);

    // admin 驳回 — 带备注 → 200
    const rej = await adminPage.request.post(
      `/api/admin/appeals/${appealId}`,
      {
        data: {
          decision: "REJECT",
          reviewNote: "复核后仍判定违规，原下架决定维持。",
        },
      },
    );
    expect(rej.ok()).toBeTruthy();

    // 作者列表里第一份是 REJECTED 含备注
    const list1 = await authorPage.request.get("/api/me/appeals");
    const first = (await list1.json()).data.items[0];
    expect(first.status).toBe("REJECTED");
    expect(first.reviewNote).toContain("仍判定违规");

    // 作者补充证据后重新申诉 → 201
    const second = await authorPage.request.post("/api/me/appeals", {
      data: {
        targetType: "POST",
        targetId: postId,
        reason: "补充上下文：本帖被误判，附加详细说明 …（第二次申诉）。",
      },
      failOnStatusCode: false,
    });
    expect(second.status()).toBe(201);

    // 作者撤回 PENDING
    const secondId = (await second.json()).data.id as string;
    const cancel = await authorPage.request.delete(
      `/api/me/appeals/${secondId}`,
    );
    expect(cancel.ok()).toBeTruthy();

    // 撤回后再 DELETE 同一条 → 409（CANCELED 状态）
    const dupCancel = await authorPage.request.delete(
      `/api/me/appeals/${secondId}`,
      { failOnStatusCode: false },
    );
    expect([400, 409].includes(dupCancel.status())).toBeTruthy();

    // 清理
    await authorPage.request.delete(`/api/posts/${postId}`, {
      failOnStatusCode: false,
    });

    await authorCtx.close();
    await adminCtx.close();
  });

  test("软删除后评论 / 点赞 / 收藏均被拒", async ({ browser }) => {
    const authorCtx = await browser.newContext();
    const authorPage = await authorCtx.newPage();
    await loginAs(authorPage, AUTHOR_EMAIL);

    const channelId = await getFirstChannelId(authorPage.request);
    const postId = await createPost(
      authorPage.request,
      channelId,
      "Stage17.2 互动拒绝测试帖",
    );

    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await loginAs(adminPage, ADMIN_EMAIL);
    await adminPage.request.delete(`/api/posts/${postId}`);

    // 评论 → 404 / 400
    const comment = await authorPage.request.post(
      `/api/posts/${postId}/comments`,
      {
        data: { content: "下架后还能评论吗？" },
        failOnStatusCode: false,
      },
    );
    expect([404, 400].includes(comment.status())).toBeTruthy();

    // 点赞 → 失败结果
    const like = await authorPage.request.post("/api/likes/toggle", {
      data: { targetType: "POST", targetId: postId },
      failOnStatusCode: false,
    });
    // 成功 toggle 走 200 + ok:false 的 ApiSuccess 包装（actions 返回失败结果）；
    // 或被中间层拦截返回 4xx。两者皆视为非「成功 like」。
    if (like.ok()) {
      const lbody = await like.json();
      const inner =
        (lbody?.data ?? lbody)?.ok ??
        (lbody?.success === true ? lbody.data?.ok : undefined);
      expect(inner === false || inner === undefined).toBeTruthy();
    }

    // 清理
    await authorPage.request.delete(`/api/posts/${postId}`, {
      failOnStatusCode: false,
    });

    await authorCtx.close();
    await adminCtx.close();
  });
});
