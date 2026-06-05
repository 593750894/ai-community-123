import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { success, error } from "@/lib/response";
import { ValidationError } from "@/lib/errors";
import { UpdateProfileSchema } from "@/lib/auth/schemas";

// Stage 9：用户改基本资料。复用 ProfileEdit 的 schema。

export async function PUT(request: Request) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const parsed = UpdateProfileSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        "参数校验失败",
        parsed.error.flatten().fieldErrors,
      );
    }
    await prisma.user.update({
      where: { id: user.id },
      data: parsed.data,
    });
    return success(null, "已保存");
  } catch (err) {
    return error(err);
  }
}
