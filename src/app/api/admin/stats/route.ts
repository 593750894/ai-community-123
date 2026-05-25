import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { ForbiddenError } from "@/lib/errors";
import { success, error } from "@/lib/response";

export async function GET() {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN") throw new ForbiddenError();

    const [users, posts, works, collaborations, tools, conversations] =
      await Promise.all([
        prisma.user.count(),
        prisma.post.count(),
        prisma.work.count(),
        prisma.collaboration.count(),
        prisma.tool.count(),
        prisma.conversation.count(),
      ]);

    return success({
      users,
      posts,
      works,
      collaborations,
      tools,
      conversations,
    });
  } catch (err) {
    return error(err);
  }
}
