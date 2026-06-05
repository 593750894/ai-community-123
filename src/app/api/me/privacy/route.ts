import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { ValidationError } from "@/lib/errors";
import { success, error } from "@/lib/response";

const PrivacySchema = z.object({
  isProfilePublic: z.boolean(),
});

export async function PUT(request: Request) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const parsed = PrivacySchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        "参数校验失败",
        parsed.error.flatten().fieldErrors,
      );
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { isProfilePublic: parsed.data.isProfilePublic },
    });
    return success(null, "已保存");
  } catch (err) {
    return error(err);
  }
}
