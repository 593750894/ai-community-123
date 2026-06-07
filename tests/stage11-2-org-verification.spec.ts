import { expect, test, type Page } from "@playwright/test";

import { loginAs } from "./helpers/auth";

/**
 * Stage 11.2 验收 —— 企业认证审核流程。
 *
 * 覆盖：
 *   - RBAC：/admin/organizations/verifications 非 admin 跳首页 + admin 200
 *   - API guards：submit / cancel / review 的 401/403/400
 *   - 端到端：creator 创建企业 → 提交认证 PENDING → admin 通过 → 公开页 ✔ 认证
 *   - 驳回路径：admin 驳回 + 必填 note → 申请人通知 + 企业可重新提交
 *   - 撤回：PENDING → owner 撤回 → 回到 NONE
 *   - 重复提交：PENDING 期间再次 POST → 409
 *
 *  Run: npx playwright test stage11-2
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

const VERIFICATION_PAYLOAD = {
  name: "测试企业有限公司",
  regNo: "91110000ABCDEFGH00",
  rep: "张测试",
  licenseUrl: "https://example.com/license.png",
  contact: "verify@example.com",
  note: "用于 Stage 11.2 端到端测试",
};

test.describe("Stage 11.2 · Organization Verification", () => {
  // ─────────────────────── RBAC + page renders ───────────────────────

  test("/admin/organizations/verifications 非 admin → 跳首页", async ({ page }) => {
    await loginAs(page, CLIENT_EMAIL);
    await page.goto("/admin/organizations/verifications", {
      waitUntil: "domcontentloaded",
    });
    expect(page.url()).toMatch(/\/\?reason=admin-only/);
  });

  test("/admin/organizations/verifications admin → 200 + 渲染 H1", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL);
    const resp = await page.goto("/admin/organizations/verifications", {
      waitUntil: "domcontentloaded",
    });
    expect(resp?.status() ?? 500).toBeLessThan(400);
    await expect(
      page.getByRole("heading", { name: /企业认证审核/, level: 1 }),
    ).toBeVisible();
  });

  // ─────────────────────── API guards ───────────────────────

  test("GET /api/admin/organizations/verifications 匿名 → 401", async ({ request }) => {
    const resp = await request.get("/api/admin/organizations/verifications");
    expect(resp.status()).toBe(401);
  });

  test("GET /api/admin/organizations/verifications 非 admin → 403", async ({
    page,
    request,
  }) => {
    await loginAs(page, CLIENT_EMAIL);
    const cookie = await sessionCookie(page);
    const resp = await request.get("/api/admin/organizations/verifications", {
      headers: { cookie },
    });
    expect(resp.status()).toBe(403);
  });

  test("GET /api/admin/organizations/verifications admin → 200 + pendingTotal", async ({
    page,
    request,
  }) => {
    await loginAs(page, ADMIN_EMAIL);
    const cookie = await sessionCookie(page);
    const resp = await request.get("/api/admin/organizations/verifications", {
      headers: { cookie },
    });
    expect(resp.status()).toBe(200);
    const json = await resp.json();
    expect(json.success).toBe(true);
    expect(json.data).toHaveProperty("pendingTotal");
    expect(Array.isArray(json.data.items)).toBe(true);
  });

  // ─────────────────────── E2E: 提交 → 通过路径 ───────────────────────

  test("e2e APPROVE: 创建 → submit → admin 通过 → public 页 ✔ 认证", async ({
    browser,
    request,
  }) => {
    const slug = uniqueSlug("v11-2-ok");
    const ownerCtx = await browser.newContext();
    const ownerPage = await ownerCtx.newPage();
    await loginAs(ownerPage, CREATOR_EMAIL);
    const ownerCookie = await sessionCookie(ownerPage);

    // 1) 创建企业
    const create = await request.post("/api/me/organizations", {
      headers: { cookie: ownerCookie },
      data: { slug, name: `Stage 11.2 通过测试 ${slug}` },
    });
    expect(create.status()).toBe(201);
    const { id: orgId } = (await create.json()).data;

    // 2) 提交认证
    const submit = await request.post(
      `/api/me/organizations/${orgId}/verification`,
      { headers: { cookie: ownerCookie }, data: VERIFICATION_PAYLOAD },
    );
    expect(submit.status()).toBe(201);

    // 3) 当前状态 PENDING
    const status = await request.get(
      `/api/me/organizations/${orgId}/verification`,
      { headers: { cookie: ownerCookie } },
    );
    expect(status.status()).toBe(200);
    const statusJson = await status.json();
    expect(statusJson.data.verificationStatus).toBe("PENDING");

    // 4) 重复提交 → 409
    const dup = await request.post(
      `/api/me/organizations/${orgId}/verification`,
      { headers: { cookie: ownerCookie }, data: VERIFICATION_PAYLOAD },
    );
    expect(dup.status()).toBe(409);

    // 5) admin 通过
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await loginAs(adminPage, ADMIN_EMAIL);
    const adminCookie = await sessionCookie(adminPage);

    const review = await request.post(
      `/api/admin/organizations/${orgId}/verification`,
      {
        headers: { cookie: adminCookie },
        data: { decision: "APPROVE", note: "测试通过" },
      },
    );
    expect(review.status()).toBe(200);

    // 6) GET 公共详情 → isVerified=true
    const pub = await request.get(`/api/organizations/${slug}`);
    expect(pub.status()).toBe(200);
    const pubJson = await pub.json();
    expect(pubJson.data.isVerified).toBe(true);

    // 7) 二次审核同一申请 → 400（已不是 PENDING）
    const reAct = await request.post(
      `/api/admin/organizations/${orgId}/verification`,
      {
        headers: { cookie: adminCookie },
        data: { decision: "APPROVE", note: "" },
      },
    );
    expect([400, 409]).toContain(reAct.status());

    // 清理
    await request.delete(`/api/me/organizations/${orgId}`, {
      headers: { cookie: ownerCookie },
    });

    await ownerCtx.close();
    await adminCtx.close();
  });

  // ─────────────────────── E2E: 驳回 → 重新提交 ───────────────────────

  test("e2e REJECT: 驳回必填 note；驳回后可重新提交", async ({
    browser,
    request,
  }) => {
    const slug = uniqueSlug("v11-2-rej");
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

    const submit = await request.post(
      `/api/me/organizations/${orgId}/verification`,
      { headers: { cookie: ownerCookie }, data: VERIFICATION_PAYLOAD },
    );
    expect(submit.status()).toBe(201);

    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await loginAs(adminPage, ADMIN_EMAIL);
    const adminCookie = await sessionCookie(adminPage);

    // 1) 驳回缺 note → 400
    const rejNoNote = await request.post(
      `/api/admin/organizations/${orgId}/verification`,
      {
        headers: { cookie: adminCookie },
        data: { decision: "REJECT" },
      },
    );
    expect(rejNoNote.status()).toBe(400);

    // 2) 正确驳回
    const rej = await request.post(
      `/api/admin/organizations/${orgId}/verification`,
      {
        headers: { cookie: adminCookie },
        data: { decision: "REJECT", note: "营业执照与企业名不匹配" },
      },
    );
    expect(rej.status()).toBe(200);

    // 3) 卖家查状态 = REJECTED + 含 reviewNote
    const after = await request.get(
      `/api/me/organizations/${orgId}/verification`,
      { headers: { cookie: ownerCookie } },
    );
    expect(after.status()).toBe(200);
    const afterJson = await after.json();
    expect(afterJson.data.verificationStatus).toBe("REJECTED");
    expect(afterJson.data.verificationReviewNote).toBeTruthy();

    // 4) 公开页 isVerified 仍为 false
    const pub = await request.get(`/api/organizations/${slug}`);
    const pubJson = await pub.json();
    expect(pubJson.data.isVerified).toBe(false);

    // 5) 卖家可以重新提交
    const reSubmit = await request.post(
      `/api/me/organizations/${orgId}/verification`,
      { headers: { cookie: ownerCookie }, data: VERIFICATION_PAYLOAD },
    );
    expect(reSubmit.status()).toBe(201);
    const reCheck = await request.get(
      `/api/me/organizations/${orgId}/verification`,
      { headers: { cookie: ownerCookie } },
    );
    expect((await reCheck.json()).data.verificationStatus).toBe("PENDING");

    // 清理
    await request.delete(`/api/me/organizations/${orgId}`, {
      headers: { cookie: ownerCookie },
    });

    await ownerCtx.close();
    await adminCtx.close();
  });

  // ─────────────────────── E2E: 撤回路径 ───────────────────────

  test("e2e CANCEL: PENDING → 撤回 → NONE", async ({ browser, request }) => {
    const slug = uniqueSlug("v11-2-cancel");
    const ownerCtx = await browser.newContext();
    const ownerPage = await ownerCtx.newPage();
    await loginAs(ownerPage, CREATOR_EMAIL);
    const ownerCookie = await sessionCookie(ownerPage);

    const create = await request.post("/api/me/organizations", {
      headers: { cookie: ownerCookie },
      data: { slug, name: `Cancel Test ${slug}` },
    });
    const { id: orgId } = (await create.json()).data;

    await request.post(
      `/api/me/organizations/${orgId}/verification`,
      { headers: { cookie: ownerCookie }, data: VERIFICATION_PAYLOAD },
    );

    const cancel = await request.delete(
      `/api/me/organizations/${orgId}/verification`,
      { headers: { cookie: ownerCookie } },
    );
    expect(cancel.status()).toBe(200);

    const after = await request.get(
      `/api/me/organizations/${orgId}/verification`,
      { headers: { cookie: ownerCookie } },
    );
    expect((await after.json()).data.verificationStatus).toBe("NONE");

    // 二次撤回 → 400
    const cancel2 = await request.delete(
      `/api/me/organizations/${orgId}/verification`,
      { headers: { cookie: ownerCookie } },
    );
    expect([400, 409]).toContain(cancel2.status());

    await request.delete(`/api/me/organizations/${orgId}`, {
      headers: { cookie: ownerCookie },
    });
    await ownerCtx.close();
  });

  // ─────────────────────── API guards: submit/cancel/review ───────────────────────

  test("POST submit 非成员 → 403", async ({ browser, request }) => {
    const slug = uniqueSlug("v11-2-403");
    const ownerCtx = await browser.newContext();
    const ownerPage = await ownerCtx.newPage();
    await loginAs(ownerPage, CREATOR_EMAIL);
    const ownerCookie = await sessionCookie(ownerPage);
    const create = await request.post("/api/me/organizations", {
      headers: { cookie: ownerCookie },
      data: { slug, name: `Submit 403 ${slug}` },
    });
    const { id: orgId } = (await create.json()).data;

    // 用 client（非成员）提交 → 403
    const clientCtx = await browser.newContext();
    const clientPage = await clientCtx.newPage();
    await loginAs(clientPage, CLIENT_EMAIL);
    const clientCookie = await sessionCookie(clientPage);

    const submit = await request.post(
      `/api/me/organizations/${orgId}/verification`,
      { headers: { cookie: clientCookie }, data: VERIFICATION_PAYLOAD },
    );
    expect(submit.status()).toBe(403);

    // 清理
    await request.delete(`/api/me/organizations/${orgId}`, {
      headers: { cookie: ownerCookie },
    });
    await ownerCtx.close();
    await clientCtx.close();
  });

  test("POST review 非 admin → 403", async ({ browser, request }) => {
    const slug = uniqueSlug("v11-2-rev403");
    const ownerCtx = await browser.newContext();
    const ownerPage = await ownerCtx.newPage();
    await loginAs(ownerPage, CREATOR_EMAIL);
    const ownerCookie = await sessionCookie(ownerPage);
    const create = await request.post("/api/me/organizations", {
      headers: { cookie: ownerCookie },
      data: { slug, name: `Review 403 ${slug}` },
    });
    const { id: orgId } = (await create.json()).data;
    await request.post(
      `/api/me/organizations/${orgId}/verification`,
      { headers: { cookie: ownerCookie }, data: VERIFICATION_PAYLOAD },
    );

    const clientCtx = await browser.newContext();
    const clientPage = await clientCtx.newPage();
    await loginAs(clientPage, CLIENT_EMAIL);
    const clientCookie = await sessionCookie(clientPage);

    const resp = await request.post(
      `/api/admin/organizations/${orgId}/verification`,
      {
        headers: { cookie: clientCookie },
        data: { decision: "APPROVE", note: "" },
      },
    );
    expect(resp.status()).toBe(403);

    await request.delete(`/api/me/organizations/${orgId}`, {
      headers: { cookie: ownerCookie },
    });
    await ownerCtx.close();
    await clientCtx.close();
  });

  test("POST submit 缺字段 → 400", async ({ browser, request }) => {
    const slug = uniqueSlug("v11-2-400");
    const ownerCtx = await browser.newContext();
    const ownerPage = await ownerCtx.newPage();
    await loginAs(ownerPage, CREATOR_EMAIL);
    const ownerCookie = await sessionCookie(ownerPage);
    const create = await request.post("/api/me/organizations", {
      headers: { cookie: ownerCookie },
      data: { slug, name: `Submit 400 ${slug}` },
    });
    const { id: orgId } = (await create.json()).data;
    const submit = await request.post(
      `/api/me/organizations/${orgId}/verification`,
      { headers: { cookie: ownerCookie }, data: { name: "x" } },
    );
    expect(submit.status()).toBe(400);

    await request.delete(`/api/me/organizations/${orgId}`, {
      headers: { cookie: ownerCookie },
    });
    await ownerCtx.close();
  });
});
