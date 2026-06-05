import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { ValidationError } from "@/lib/errors";
import { success, error } from "@/lib/response";
import { verifyPassword } from "@/lib/auth/password";
import { clearSessionCookie } from "@/lib/auth/session";
import { createRateLimiter } from "@/lib/rate-limit";

const DeleteBodySchema = z.object({
  currentPassword: z.string().min(1, "请输入当前密码"),
});

const limiter = createRateLimiter({
  name: "delete-account",
  limit: 3,
  windowMs: 60 * 60 * 1000,
});

// Stage 9：注销 = 软删除 + PII 清洗。
// - status = DELETED（之后 getCurrentUser 直接 return null）。
// - 清空 bio / industryRole / portfolioLinks / favoriteTools / expertise / contact / avatar。
// - 邮箱 / 用户名保留以维护 unique 约束；昵称改成「已注销」。
// - tokensValidAfter = now，踢出所有设备。
// - 帖子 / 评论 / 作品 等内容保留（社区可读性优先）。

export async function DELETE(request: Request) {
  try {
    const user = await requireAuth();
    limiter.check(user.id);

    const body = await request.json().catch(() => ({}));
    const parsed = DeleteBodySchema.safeParse(body);
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
    if (!me) throw new ValidationError("账号状态异常");
    const ok = await verifyPassword(parsed.data.currentPassword, me.passwordHash);
    if (!ok) throw new ValidationError("当前密码不正确");

    const now = new Date();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        status: "DELETED",
        name: "已注销",
        avatar: null,
        bio: null,
        industryRole: null,
        contact: null,
        expertise: [],
        favoriteTools: [],
        portfolioLinks: [],
        isProfilePublic: false,
        tokensValidAfter: now,
      },
    });

    await clearSessionCookie();

    return success(null, "账号已注销");
  } catch (err) {
    return error(err);
  }
}
