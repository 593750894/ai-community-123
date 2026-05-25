import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { success, error } from "@/lib/response";
import { parsePagination, paginatedResponse } from "@/lib/pagination";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ channelId: string }> },
) {
  try {
    const { channelId } = await params;

    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      select: { id: true },
    });
    if (!channel) throw new NotFoundError("频道");

    const url = new URL(request.url);
    const { page, pageSize, skip } = parsePagination(url);
    const type = url.searchParams.get("type") || undefined;

    const where = {
      channelId,
      ...(type ? { type: type as never } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.post.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: {
          author: {
            select: { id: true, username: true, name: true, avatar: true },
          },
        },
      }),
      prisma.post.count({ where }),
    ]);

    return success(paginatedResponse(items, total, page, pageSize));
  } catch (err) {
    return error(err);
  }
}
