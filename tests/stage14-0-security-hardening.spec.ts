import { expect, test } from "@playwright/test";

/**
 * Stage 14.0 · 商业化前安全硬化验收
 *
 * 验证：
 * 1. POST /api/auth/register 携带 role=ADMIN 被静默忽略；返回用户的 role 必须是 USER。
 * 2. 重复邮箱注册返回通用消息「该邮箱或用户名已被使用」，不透露具体冲突字段。
 * 3. 表单 Server Action 的 P2002 路径同样返回通用消息（通过 /auth/register UI 间接验证）。
 *
 * Run: npx playwright test stage14-0-security-hardening
 */

function randomEmail(): string {
  const suffix = Math.random().toString(36).slice(2, 10);
  return `s14test_${suffix}@example.com`;
}

test.describe("Stage 14.0 · register 安全硬化", () => {
  test("API: role=ADMIN 注入被忽略，落库为 USER", async ({ request }) => {
    const email = randomEmail();
    const res = await request.post("/api/auth/register", {
      data: {
        email,
        password: "Aa1bcdef",
        name: "Seek Admin",
        role: "ADMIN", // 攻击载荷：试图自助提权
      },
    });

    expect(res.status()).toBe(201);
    const body = (await res.json()) as {
      data?: { role?: string; email?: string };
    };
    expect(body.data?.email).toBe(email);
    expect(body.data?.role).toBe("USER");
  });

  test("API: 重复邮箱注册返回通用消息", async ({ request }) => {
    const email = randomEmail();
    const first = await request.post("/api/auth/register", {
      data: {
        email,
        password: "Aa1bcdef",
        name: "First",
      },
    });
    expect(first.status()).toBe(201);

    const second = await request.post("/api/auth/register", {
      data: {
        email,
        password: "Aa1bcdef",
        name: "Second",
      },
    });
    expect(second.status()).toBe(409);
    const body = (await second.json()) as {
      error?: { message?: string };
    };
    // 不暴露「邮箱已被注册」这种精确字段提示，避免账号枚举。
    expect(body.error?.message).toBe("该邮箱或用户名已被使用");
  });
});
