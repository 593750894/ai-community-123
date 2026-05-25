import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { ValidationError } from "@/lib/errors";
import { success, created, error } from "@/lib/response";
import { CreatePostSchema } from "@/lib/posts/schemas";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { POST_TYPE_VALUES } from "@/lib/post-types";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const { page, pageSize, skip } = parsePagination(url);
    const channelId = url.searchParams.get("channelId") || undefined;
    const type = url.searchParams.get("type") || undefined;
    const search = url.searchParams.get("search")?.trim() || undefined;

    const where: Record<string, unknown> = {};

    if (channelId) where.channelId = channelId;
    if (type && (POST_TYPE_VALUES as readonly string[]).includes(type)) {
      where.type = type;
    }

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

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const parsed = CreatePostSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("参数校验失败", parsed.error.flatten().fieldErrors);
    }

    const { channelId, type, title, content, videoUrl, imageUrl } = parsed.data;

    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      select: { id: true },
    });
    if (!channel) {
      throw new ValidationError("频道不存在");
    }

    const post = await prisma.post.create({
      data: {
        channelId,
        authorId: user.id,
        type,
        title,
        content,
        videoUrl,
        imageUrl,
      },
      include: {
        author: {
          select: { id: true, username: true, name: true, avatar: true },
        },
        channel: {
          select: { id: true, slug: true, name: true, icon: true, color: true },
        },
      },
    });

    return created(post, "发帖成功");
  } catch (err) {
    return error(err);
  }
}
