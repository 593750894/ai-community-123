import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { ValidationError } from "@/lib/errors";
import { success, created, error } from "@/lib/response";
import { StartConversationSchema } from "@/lib/messages/schemas";
import { findDirectConversation } from "@/lib/messages/queries";
import { parsePagination, paginatedResponse } from "@/lib/pagination";

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
    const body = await request.json();
    const parsed = StartConversationSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("参数校验失败", parsed.error.flatten().fieldErrors);
    }

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
                select: { id: true, username: true, name: true, avatar: true },
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
  } catch (err) {
    return error(err);
  }
}
