import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { ForbiddenError } from "@/lib/errors";
import { success, error } from "@/lib/response";
import { parsePagination, paginatedResponse } from "@/lib/pagination";

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN") throw new ForbiddenError();

    const url = new URL(request.url);
    const { page, pageSize, skip } = parsePagination(url);
    const channelId = url.searchParams.get("channelId") || undefined;
    const type = url.searchParams.get("type") || undefined;
    const search = url.searchParams.get("search")?.trim() || undefined;

    const where: Record<string, unknown> = {};

    if (channelId) where.channelId = channelId;
    if (type) where.type = type as never;

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { content: { contains: search, mode: "insensitive" } },
      ];
    }

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
          channel: {
            select: { id: true, slug: true, name: true, icon: true, color: true },
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
