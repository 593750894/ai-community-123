import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { requireActiveUser } from "@/lib/auth/suspension";
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from "@/lib/errors";
import { success, error } from "@/lib/response";
import { toggleFollow } from "@/lib/follows/queries";
import { notifyFollow } from "@/lib/notifications/emit";

const ToggleFollowSchema = z.object({
  userId: z.string().min(1, "userId 不能为空"),
});

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    await requireActiveUser(user);
    const body = await request.json();
    const parsed = ToggleFollowSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        "参数校验失败",
        parsed.error.flatten().fieldErrors,
      );
    }

    const targetId = parsed.data.userId;
    if (targetId === user.id) {
      throw new ForbiddenError("不能关注自己");
    }

    const target = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true },
    });
    if (!target) throw new NotFoundError("用户");

    const result = await toggleFollow({
      followerId: user.id,
      followingId: targetId,
    });

    if (result.created) {
      await notifyFollow({ followingId: targetId, actorId: user.id });
    }

    return success({
      following: result.following,
      followerCount: result.followerCount,
    });
  } catch (err) {
    return error(err);
  }
}
