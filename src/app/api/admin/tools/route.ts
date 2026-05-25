import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import { success, created, error } from "@/lib/response";
import { CreateToolSchema } from "@/schemas/tool.schema";
import { isToolCategoryValue } from "@/lib/tools/categories";
import { parsePagination, paginatedResponse } from "@/lib/pagination";

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN") throw new ForbiddenError();

    const url = new URL(request.url);
    const { page, pageSize, skip } = parsePagination(url);
    const category = url.searchParams.get("category") || undefined;
    const pricing = url.searchParams.get("pricing") || undefined;
    const search = url.searchParams.get("search")?.trim() || undefined;

    const where: Record<string, unknown> = {};

    if (category && isToolCategoryValue(category)) {
      where.category = category;
    }
    if (pricing && ["FREE", "FREEMIUM", "PAID"].includes(pricing)) {
      where.pricing = pricing;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { tags: { has: search } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.tool.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: {
          createdBy: {
            select: { id: true, username: true, name: true, avatar: true },
          },
        },
      }),
      prisma.tool.count({ where }),
    ]);

    return success(paginatedResponse(items, total, page, pageSize));
  } catch (err) {
    return error(err);
  }
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (base.length >= 2) return base;
  return `tool-${Date.now().toString(36)}`;
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN") throw new ForbiddenError();

    const body = await request.json();
    const parsed = CreateToolSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("参数校验失败", parsed.error.flatten().fieldErrors);
    }

    const { name, description, url: toolUrl, category, useCase, logoUrl, pricing, tags } = parsed.data;

    let slug = slugify(name);
    for (let i = 0; i < 5; i++) {
      const exists = await prisma.tool.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!exists) break;
      slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;
    }

    const tool = await prisma.tool.create({
      data: {
        slug,
        name,
        description,
        url: toolUrl,
        category,
        useCase,
        logoUrl: logoUrl ?? `https://api.dicebear.com/9.x/icons/svg?seed=${encodeURIComponent(slug)}`,
        pricing,
        tags,
        createdById: user.id,
      },
      include: {
        createdBy: {
          select: { id: true, username: true, name: true, avatar: true },
        },
      },
    });

    return created(tool, "工具添加成功");
  } catch (err) {
    return error(err);
  }
}
