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
    const status = url.searchParams.get("status") || undefined;
    const category = url.searchParams.get("category") || undefined;
    const type = url.searchParams.get("type") || undefined;
    const search = url.searchParams.get("search")?.trim() || undefined;

    const where: Record<string, unknown> = {};

    if (status && ["OPEN", "IN_PROGRESS", "CLOSED"].includes(status)) {
      where.status = status;
    }
    if (category) where.category = category as never;
    if (type && ["LOOKING_FOR", "OFFERING"].includes(type)) {
      where.type = type;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.collaboration.findMany({
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
      prisma.collaboration.count({ where }),
    ]);

    return success(paginatedResponse(items, total, page, pageSize));
  } catch (err) {
    return error(err);
  }
}
