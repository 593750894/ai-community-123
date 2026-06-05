import { z } from "zod";

import { prisma, Prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { ValidationError } from "@/lib/errors";
import { success, error } from "@/lib/response";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionCookie } from "@/lib/auth/session";
import { createRateLimiter } from "@/lib/rate-limit";

const ChangeEmailSchema = z.object({
  newEmail: z.email("请输入有效邮箱"),
  currentPassword: z.string().min(1, "请输入当前密码"),
});

const limiter = createRateLimiter({
  name: "change-email",
  limit: 5,
  windowMs: 60 * 60 * 1000,
});

export async function PUT(request: Request) {
  try {
    const user = await requireAuth();
    limiter.check(user.id);

    const body = await request.json();
    const parsed = ChangeEmailSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        "参数校验失败",
        parsed.error.flatten().fieldErrors,
      );
    }

    if (parsed.data.newEmail === user.email) {
      throw new ValidationError("新邮箱与当前邮箱相同");
    }

    const me = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    if (!me) throw new ValidationError("账号状态异常");
    const ok = await verifyPassword(parsed.data.currentPassword, me.passwordHash);
    if (!ok) throw new ValidationError("当前密码不正确");

    const validAfter = new Date(Date.now() + 1000);

    try {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          email: parsed.data.newEmail,
          tokensValidAfter: validAfter,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new ValidationError("该邮箱已被注册");
      }
      throw e;
    }

    await createSessionCookie({ userId: user.id, username: user.username });

    return success(null, "邮箱已修改，其他设备的登录态已失效");
  } catch (err) {
    return error(err);
  }
}
