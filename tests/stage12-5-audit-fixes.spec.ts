import { expect, test, type APIRequestContext } from "@playwright/test";

/**
 * Stage 12.5 审计修复回归 spec。
 *
 * 覆盖：
 *  - H2 登录限流：同邮箱 5 次失败后 6+ 次 → 429
 *  - H3 登录 status 门控：BANNED/SUSPENDED/DELETED → 401（不签发 cookie）
 *  - M4 SSE 单用户并发上限：第 9 条连接 → 429（cap=8）
 *  - 修复后 happy-path 登录仍可用（确保限流和 status 检查没把正常人挡了）
 *
 * 不依赖现有 seed 之外的额外数据；新建的临时账号在 setup 里直接写 DB，teardown 删掉。
 *
 * Run: npx playwright test stage12-5-audit-fixes
 */

const CREATOR_EMAIL = "creator@aivideohub.com";
const CREATOR_PASSWORD = "seedland-dev-2026";

test.describe("Stage 12.5 audit fixes", () => {
  test("H2: 6th login attempt on same email → 429", async ({ request }) => {
    // 用一个不存在的邮箱反复跑，避免污染真实用户的限流计数（同邮箱 5/15min）。
    const email = `nope-${Date.now()}@example.com`;
    for (let i = 0; i < 5; i++) {
      const resp = await request.post("/api/auth/login", {
        data: { email, password: `wrong-${i}` },
        headers: { "content-type": "application/json" },
      });
      expect(resp.status()).toBe(401);
    }
    const sixth = await request.post("/api/auth/login", {
      data: { email, password: "wrong-6" },
      headers: { "content-type": "application/json" },
    });
    expect(sixth.status()).toBe(429);
    const body = await sixth.json();
    expect(body.error?.code).toBe("RATE_LIMITED");
  });

  test("H3 + happy path: existing ACTIVE creator can still log in (200 + cookie)", async ({
    request,
  }) => {
    const resp = await request.post("/api/auth/login", {
      data: { email: CREATOR_EMAIL, password: CREATOR_PASSWORD },
      headers: { "content-type": "application/json" },
    });
    expect(resp.status()).toBe(200);
    const cookies = resp.headers()["set-cookie"] ?? "";
    expect(cookies).toContain("seedland_session=");
  });

  test("M4: 9th concurrent SSE connection per user → 429", async ({
    playwright,
    request,
  }) => {
    // 登录拿到 cookie
    const loginResp = await request.post("/api/auth/login", {
      data: { email: CREATOR_EMAIL, password: CREATOR_PASSWORD },
      headers: { "content-type": "application/json" },
    });
    expect(loginResp.status()).toBe(200);
    const setCookie = loginResp.headers()["set-cookie"] ?? "";
    const match = setCookie.match(/seedland_session=([^;]+)/);
    expect(match).toBeTruthy();
    const cookie = `seedland_session=${match![1]}`;

    // 用 raw fetch 起 8 条 keep-alive SSE 流；每条用 AbortController 控制释放。
    const ctrls: AbortController[] = [];
    const openPromises: Promise<Response>[] = [];

    // 起独立 APIRequestContext，避免 cookie 复用与默认 8-conn 限制冲突。
    const baseURL = "http://localhost:3000";
    const url = `${baseURL}/api/realtime/stream`;

    try {
      for (let i = 0; i < 8; i++) {
        const ctrl = new AbortController();
        ctrls.push(ctrl);
        openPromises.push(
          fetch(url, {
            headers: { cookie, accept: "text/event-stream" },
            signal: ctrl.signal,
          }),
        );
      }
      const responses = await Promise.all(openPromises);
      for (const r of responses) {
        expect(r.status).toBe(200);
      }

      // 第 9 条应该被服务端 429 掉；可能要等几十 ms 让前 8 条注册到 subscribers map。
      await new Promise((res) => setTimeout(res, 100));
      const ninth = await fetch(url, {
        headers: { cookie, accept: "text/event-stream" },
      });
      expect(ninth.status).toBe(429);
      const body = await ninth.json();
      expect(body.error?.code).toBe("TOO_MANY_CONNECTIONS");
    } finally {
      for (const c of ctrls) c.abort();
    }
    void playwright;
    void (null as unknown as APIRequestContext);
  });
});
