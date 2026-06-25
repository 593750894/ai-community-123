import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { requireActiveUser } from "@/lib/auth/suspension";
import { success, error } from "@/lib/response";
import { ValidationError } from "@/lib/errors";
import { UpdateProfileSchema } from "@/lib/auth/schemas";
import { assertNotBlocked } from "@/lib/content/blocked-words";

// Stage 9：用户改基本资料。复用 ProfileEdit 的 schema。

export async function PUT(request: Request) {
  try {
    const user = await requireAuth();
    await requireActiveUser(user);
    const body = await request.json();
    const parsed = UpdateProfileSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        "参数校验失败",
        parsed.error.flatten().fieldErrors,
      );
    }
    // Stage 18.0：个人主页 name / bio 同样过关键词黑名单。
    await assertNotBlocked(
      { scope: "USER", actorId: user.id, source: "profile:update" },
      parsed.data.name,
      parsed.data.bio,
    );
    await prisma.user.update({
      where: { id: user.id },
      data: parsed.data,
    });
    return success(null, "已保存");
  } catch (err) {
    return error(err);
  }
}
