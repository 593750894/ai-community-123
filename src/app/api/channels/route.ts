import { prisma } from "@/lib/db";
import { success, error } from "@/lib/response";

export async function GET() {
  try {
    const channels = await prisma.channel.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        _count: { select: { posts: true, members: true } },
      },
    });
    return success(channels);
  } catch (err) {
    return error(err);
  }
}
