import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { ValidationError } from "@/lib/errors";
import { success, created, error } from "@/lib/response";
import { CreateWorkSchema } from "@/lib/works/schemas";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { WORK_CATEGORY_VALUES } from "@/lib/work-categories";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const { page, pageSize, skip } = parsePagination(url);
    const category = url.searchParams.get("category") || undefined;
    const toolsUsed = url.searchParams.get("toolsUsed") || url.searchParams.get("tool") || undefined;
    const authorId = url.searchParams.get("authorId") || undefined;
    const search = url.searchParams.get("search")?.trim() || undefined;

    const where: Record<string, unknown> = { isPublic: true };

    if (category && (WORK_CATEGORY_VALUES as readonly string[]).includes(category)) {
      where.category = category;
    }
    if (authorId) where.authorId = authorId;
    if (toolsUsed) where.tools = { has: toolsUsed };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.work.findMany({
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
      prisma.work.count({ where }),
    ]);

    return success(paginatedResponse(items, total, page, pageSize));
  } catch (err) {
    return error(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const parsed = CreateWorkSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("参数校验失败", parsed.error.flatten().fieldErrors);
    }

    const { title, description, thumbnailUrl, videoUrl, category, tools } = parsed.data;

    const work = await prisma.work.create({
      data: {
        authorId: user.id,
        title,
        description,
        thumbnailUrl,
        videoUrl,
        category,
        tools,
      },
      include: {
        author: {
          select: { id: true, username: true, name: true, avatar: true },
        },
      },
    });

    return created(work, "作品发布成功");
  } catch (err) {
    return error(err);
  }
}
