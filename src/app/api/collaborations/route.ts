import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { ValidationError } from "@/lib/errors";
import { success, created, error } from "@/lib/response";
import { CreateCollaborationSchema } from "@/lib/collaborations/schemas";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { COLLAB_CATEGORY_VALUES, COLLAB_STATUS_VALUES, COLLAB_TYPE_VALUES } from "@/lib/collaborations/categories";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const { page, pageSize, skip } = parsePagination(url);
    const status = url.searchParams.get("status") || undefined;
    const category = url.searchParams.get("category") || undefined;
    const cooperationType = url.searchParams.get("cooperationType") || url.searchParams.get("type") || undefined;
    const search = url.searchParams.get("search")?.trim() || undefined;

    const where: Record<string, unknown> = {};

    if (status && (COLLAB_STATUS_VALUES as readonly string[]).includes(status)) {
      where.status = status;
    }
    if (category && (COLLAB_CATEGORY_VALUES as readonly string[]).includes(category)) {
      where.category = category;
    }
    if (cooperationType && (COLLAB_TYPE_VALUES as readonly string[]).includes(cooperationType)) {
      where.type = cooperationType;
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

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const parsed = CreateCollaborationSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("参数校验失败", parsed.error.flatten().fieldErrors);
    }

    const { category, type, workMode, location, title, description, budget, contact, tags } = parsed.data;

    const collaboration = await prisma.collaboration.create({
      data: {
        authorId: user.id,
        category,
        type,
        workMode,
        location,
        title,
        description,
        budget,
        contact,
        tags,
      },
      include: {
        author: {
          select: { id: true, username: true, name: true, avatar: true },
        },
      },
    });

    return created(collaboration, "合作需求发布成功");
  } catch (err) {
    return error(err);
  }
}
