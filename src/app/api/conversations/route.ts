import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { ValidationError } from "@/lib/errors";
import { success, created, error } from "@/lib/response";
import { CreateConversationSchema } from "@/lib/messages/schemas";
import { findDirectConversation } from "@/lib/messages/queries";
import { createGroupConversation } from "@/lib/messages/groups";
import { createRateLimiter } from "@/lib/rate-limit";
import { parsePagination, paginatedResponse } from "@/lib/pagination";

// Stage 12.2：群聊创建限流，防止滥发。
const createGroupLimiter = createRateLimiter({
  limit: 10,
  windowMs: 60 * 60 * 1000,
  name: "create-group",
});

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const url = new URL(request.url);
    const { page, pageSize, skip } = parsePagination(url);

    const where = {
      participants: { some: { userId: user.id } },
    };

    const [items, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        orderBy: { lastMessageAt: "desc" },
        skip,
        take: pageSize,
        include: {
          participants: {
            include: {
              user: {
                select: { id: true, username: true, name: true, avatar: true },
              },
            },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: {
              sender: {
                select: { id: true, username: true, name: true, avatar: true },
              },
            },
          },
        },
      }),
      prisma.conversation.count({ where }),
    ]);

    return success(paginatedResponse(items, total, page, pageSize));
  } catch (err) {
    return error(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body = await request.json().catch(() => ({}));
    // 兼容旧 1v1 客户端（不带 isGroup 字段）：默认按 1v1 处理。
    const normalized =
      typeof body === "object" && body !== null && "isGroup" in body
        ? body
        : { ...body, isGroup: false };
    const parsed = CreateConversationSchema.safeParse(normalized);
    if (!parsed.success) {
      throw new ValidationError(
        "参数校验失败",
        parsed.error.flatten().fieldErrors,
      );
    }

    if (parsed.data.isGroup === false) {
      const { targetUserId } = parsed.data;
      if (targetUserId === user.id) {
        throw new ValidationError("不能和自己创建会话");
      }
      const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { id: true },
      });
      if (!targetUser) {
        throw new ValidationError("目标用户不存在");
      }

      const existingMatch = await findDirectConversation(user.id, targetUserId);
      if (existingMatch) {
        const existing = await prisma.conversation.findUnique({
          where: { id: existingMatch.id },
          include: {
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    name: true,
                    avatar: true,
                  },
                },
              },
            },
          },
        });
        return success(existing, "会话已存在");
      }

      const conversation = await prisma.conversation.create({
        data: {
          isGroup: false,
          memberLimit: 2,
          participants: {
            create: [{ userId: user.id }, { userId: targetUserId }],
          },
        },
        include: {
          participants: {
            include: {
              user: {
                select: { id: true, username: true, name: true, avatar: true },
              },
            },
          },
        },
      });
      return created(conversation, "会话创建成功");
    }

    // 群聊分支
    createGroupLimiter.check(user.id);
    const { title, avatarUrl, memberIds } = parsed.data;
    const { id } = await createGroupConversation(user.id, {
      title,
      avatarUrl: avatarUrl ?? null,
      memberIds,
    });

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, username: true, name: true, avatar: true },
            },
          },
        },
      },
    });
    return created(conversation, "群聊创建成功");
  } catch (err) {
    return error(err);
  }
}
