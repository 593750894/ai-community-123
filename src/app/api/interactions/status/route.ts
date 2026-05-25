import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { ValidationError } from "@/lib/errors";
import { success, error } from "@/lib/response";
import { InteractionStatusSchema } from "@/lib/interactions/schemas";

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const url = new URL(request.url);

    const parsed = InteractionStatusSchema.safeParse({
      targetType: url.searchParams.get("targetType"),
      targetId: url.searchParams.get("targetId"),
    });
    if (!parsed.success) {
      throw new ValidationError("参数校验失败", parsed.error.flatten().fieldErrors);
    }

    const { targetType, targetId } = parsed.data;

    if (targetType === "POST") {
      const [like, bookmark] = await Promise.all([
        prisma.like.findUnique({
          where: { userId_postId: { userId: user.id, postId: targetId } },
          select: { id: true },
        }),
        prisma.bookmark.findUnique({
          where: { userId_postId: { userId: user.id, postId: targetId } },
          select: { id: true },
        }),
      ]);
      return success({ liked: !!like, bookmarked: !!bookmark });
    }

    // targetType === "WORK"
    const [like, bookmark] = await Promise.all([
      prisma.like.findUnique({
        where: { userId_workId: { userId: user.id, workId: targetId } },
        select: { id: true },
      }),
      prisma.bookmark.findUnique({
        where: { userId_workId: { userId: user.id, workId: targetId } },
        select: { id: true },
      }),
    ]);
    return success({ liked: !!like, bookmarked: !!bookmark });
  } catch (err) {
    return error(err);
  }
}
