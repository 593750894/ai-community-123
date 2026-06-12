import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionCookie } from "@/lib/auth/session";
import { LoginApiSchema } from "@/schemas/auth.schema";
import { success, error } from "@/lib/response";
import { ValidationError, UnauthorizedError } from "@/lib/errors";
import { createRateLimiter } from "@/lib/rate-limit";

// 双键限流：按邮箱拦撞库（同一账号），按 IP 拦扫号（同一来源轮询邮箱）。
// 邮箱端 5/15min：撞库挡线 —— 5 次失败后单账号锁定，攻击者必须等下一个窗口。
// IP 端 200/15min：高频扫号挡线 —— 仍远高于任何真实用户的速率（约 13.3/min），
// 防的是单 IP 高速遍历邮箱字典；分布式 IP 撞库由邮箱限流兜底。
const loginEmailLimiter = createRateLimiter({
  limit: 5,
  windowMs: 15 * 60 * 1000,
  name: "登录",
});
const loginIpLimiter = createRateLimiter({
  limit: 200,
  windowMs: 15 * 60 * 1000,
  name: "登录",
});

function clientIp(request: Request): string {
  const xf = request.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]!.trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real;
  return "anon";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = LoginApiSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("参数校验失败", parsed.error.flatten().fieldErrors);
    }

    const { email, password } = parsed.data;

    // 先 IP 限流（粗筛），再按 email 限流（精筛），任一超限抛 429。
    loginIpLimiter.check(clientIp(request));
    loginEmailLimiter.check(email.toLowerCase());

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        avatar: true,
        bio: true,
        role: true,
        status: true,
        passwordHash: true,
        createdAt: true,
      },
    });

    if (!user) throw new UnauthorizedError("邮箱或密码错误");

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) throw new UnauthorizedError("邮箱或密码错误");

    // 状态门：BANNED / DELETED / SUSPENDED 一律拒绝签发 cookie，否则 SUSPENDED 用户
    // 可以拿一个全新 iat 的 token 绕过 tokensValidAfter 的兜底（tokensValidAfter 只能
    // 让旧 token 失效，对新 token 无效）。
    if (user.status !== "ACTIVE") {
      const msgMap = {
        BANNED: "该账号已被封禁，请联系管理员",
        SUSPENDED: "该账号已被暂停，请联系管理员",
        DELETED: "该账号已注销",
      } as const;
      throw new UnauthorizedError(
        msgMap[user.status as keyof typeof msgMap] ?? "该账号不可用",
      );
    }

    await createSessionCookie({ userId: user.id, username: user.username });

    const { passwordHash: _, status: __, ...safeUser } = user;
    return success(safeUser, "登录成功");
  } catch (err) {
    return error(err);
  }
}
