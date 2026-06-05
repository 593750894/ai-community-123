import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { ValidationError } from "@/lib/errors";
import { success, error } from "@/lib/response";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSessionCookie } from "@/lib/auth/session";
import { createRateLimiter } from "@/lib/rate-limit";

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "请输入当前密码"),
  newPassword: z
    .string()
    .min(8, "新密码至少 8 个字符")
    .max(128, "新密码不能超过 128 个字符")
    .regex(/[a-zA-Z]/, "新密码需包含字母")
    .regex(/[0-9]/, "新密码需包含数字"),
});

const limiter = createRateLimiter({
  name: "change-password",
  limit: 5,
  windowMs: 60 * 60 * 1000,
});

export async function PUT(request: Request) {
  try {
    const user = await requireAuth();
    limiter.check(user.id);

    const body = await request.json();
    const parsed = ChangePasswordSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        "参数校验失败",
        parsed.error.flatten().fieldErrors,
      );
    }

    const me = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    if (!me) throw new ValidationError("账号状态异常，请重新登录");

    const ok = await verifyPassword(parsed.data.currentPassword, me.passwordHash);
    if (!ok) throw new ValidationError("当前密码不正确");

    const newHash = await hashPassword(parsed.data.newPassword);

    // 给 tokensValidAfter 加 1s slop，避免和当前 token 的 iat 同秒造成假阴性。
    const validAfter = new Date(Date.now() + 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        tokensValidAfter: validAfter,
      },
    });

    // 立刻给当前浏览器签发一张新 cookie，否则刚改完密就被本会话踢下线。
    await createSessionCookie({ userId: user.id, username: user.username });

    return success(null, "密码已修改，其他设备的登录态已失效");
  } catch (err) {
    return error(err);
  }
}
