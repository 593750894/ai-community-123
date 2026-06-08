import { prisma } from "@/lib/db";
import type { NotificationType } from "@/generated/prisma/client";

/**
 * 通知触发层
 *
 * 统一入口：emitNotification —— 自动跳过"自己操作自己"，并对同 actor + 同 target + 同 type
 * 在 24h 内做去重，避免反复点赞反复刷屏。
 *
 * 业务侧调用 `notifyXxx` 包装函数；任何失败都吞掉，不阻塞主流程。
 */

const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

const DEDUP_TYPES: Set<NotificationType> = new Set([
  "POST_LIKE",
  "WORK_LIKE",
  "COMMENT_LIKE",
  "BOOKMARK",
  "FOLLOW",
  "MENTION",
]);

/**
 * Stage 12.4：群聊消息短窗口去重 = 5 分钟。
 * 比赞/收藏的 24h 窄得多——群聊里短时间内连发多条仍只推一条通知，
 * 但用户离开后回来再发就会再次提醒；避免「群聊每条消息都炸 Bell」。
 */
const GROUP_MESSAGE_DEDUP_WINDOW_MS = 5 * 60 * 1000;

// Stage 9：用户可在 /settings/notifications 关闭通知类型；但 SYSTEM 永远直达
// （admin 举报通知、强制下线提示等运维通道，不能被用户关掉）。
const NON_GATEABLE_TYPES: Set<NotificationType> = new Set(["SYSTEM"]);

export interface EmitNotificationInput {
  recipientId: string;
  actorId?: string | null;
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
  targetType?: string | null;
  targetId?: string | null;
}

export async function emitNotification(input: EmitNotificationInput) {
  try {
    const { recipientId, actorId, type, title, body, link, targetType, targetId } = input;

    if (actorId && actorId === recipientId) return null;

    if (DEDUP_TYPES.has(type) && actorId && targetType && targetId) {
      const since = new Date(Date.now() - DEDUPE_WINDOW_MS);
      const existing = await prisma.notification.findFirst({
        where: {
          userId: recipientId,
          actorId,
          type,
          targetType,
          targetId,
          createdAt: { gte: since },
        },
        select: { id: true },
      });
      if (existing) return null;
    }

    // Stage 9：用户关闭该类型通知则跳过；缺省记录或缺省 enabled=true 都放行。
    if (!NON_GATEABLE_TYPES.has(type)) {
      const pref = await prisma.notificationPreference.findUnique({
        where: { userId_type: { userId: recipientId, type } },
        select: { enabled: true },
      });
      if (pref && !pref.enabled) return null;
    }

    return await prisma.notification.create({
      data: {
        userId: recipientId,
        actorId: actorId ?? null,
        type,
        title,
        body: body ?? null,
        link: link ?? null,
        targetType: targetType ?? null,
        targetId: targetId ?? null,
      },
      select: { id: true },
    });
  } catch (err) {
    console.error("[notifications] emit failed", err);
    return null;
  }
}

async function actorDisplay(actorId: string) {
  return prisma.user.findUnique({
    where: { id: actorId },
    select: { name: true, username: true },
  });
}

/** 点赞帖子 → 通知作者 */
export async function notifyPostLike(args: { postId: string; actorId: string }) {
  try {
    const [post, actor] = await Promise.all([
      prisma.post.findUnique({
        where: { id: args.postId },
        select: { authorId: true, title: true },
      }),
      actorDisplay(args.actorId),
    ]);
    if (!post || !actor) return;
    await emitNotification({
      recipientId: post.authorId,
      actorId: args.actorId,
      type: "POST_LIKE",
      title: `${actor.name} 赞了你的帖子`,
      body: post.title,
      link: `/post/${args.postId}`,
      targetType: "POST",
      targetId: args.postId,
    });
  } catch (err) {
    console.error("[notifications] notifyPostLike", err);
  }
}

/** 点赞作品 → 通知作者 */
export async function notifyWorkLike(args: { workId: string; actorId: string }) {
  try {
    const [work, actor] = await Promise.all([
      prisma.work.findUnique({
        where: { id: args.workId },
        select: { authorId: true, title: true },
      }),
      actorDisplay(args.actorId),
    ]);
    if (!work || !actor) return;
    await emitNotification({
      recipientId: work.authorId,
      actorId: args.actorId,
      type: "WORK_LIKE",
      title: `${actor.name} 赞了你的作品`,
      body: work.title,
      link: `/showcase/${args.workId}`,
      targetType: "WORK",
      targetId: args.workId,
    });
  } catch (err) {
    console.error("[notifications] notifyWorkLike", err);
  }
}

/** 收藏帖子 → 通知作者 */
export async function notifyPostBookmark(args: { postId: string; actorId: string }) {
  try {
    const [post, actor] = await Promise.all([
      prisma.post.findUnique({
        where: { id: args.postId },
        select: { authorId: true, title: true },
      }),
      actorDisplay(args.actorId),
    ]);
    if (!post || !actor) return;
    await emitNotification({
      recipientId: post.authorId,
      actorId: args.actorId,
      type: "BOOKMARK",
      title: `${actor.name} 收藏了你的帖子`,
      body: post.title,
      link: `/post/${args.postId}`,
      targetType: "POST",
      targetId: args.postId,
    });
  } catch (err) {
    console.error("[notifications] notifyPostBookmark", err);
  }
}

/** 收藏作品 → 通知作者 */
export async function notifyWorkBookmark(args: { workId: string; actorId: string }) {
  try {
    const [work, actor] = await Promise.all([
      prisma.work.findUnique({
        where: { id: args.workId },
        select: { authorId: true, title: true },
      }),
      actorDisplay(args.actorId),
    ]);
    if (!work || !actor) return;
    await emitNotification({
      recipientId: work.authorId,
      actorId: args.actorId,
      type: "BOOKMARK",
      title: `${actor.name} 收藏了你的作品`,
      body: work.title,
      link: `/showcase/${args.workId}`,
      targetType: "WORK",
      targetId: args.workId,
    });
  } catch (err) {
    console.error("[notifications] notifyWorkBookmark", err);
  }
}

/** 点赞评论 → 通知评论作者 */
export async function notifyCommentLike(args: {
  commentId: string;
  actorId: string;
}) {
  try {
    const [comment, actor] = await Promise.all([
      prisma.comment.findUnique({
        where: { id: args.commentId },
        select: { authorId: true, content: true, postId: true },
      }),
      actorDisplay(args.actorId),
    ]);
    if (!comment || !actor) return;
    await emitNotification({
      recipientId: comment.authorId,
      actorId: args.actorId,
      type: "COMMENT_LIKE",
      title: `${actor.name} 赞了你的评论`,
      body: comment.content.slice(0, 80),
      link: `/post/${comment.postId}#comment-${args.commentId}`,
      targetType: "COMMENT",
      targetId: args.commentId,
    });
  } catch (err) {
    console.error("[notifications] notifyCommentLike", err);
  }
}

/** 帖子被评论 → 通知作者；若评论是 reply（parentId 存在），同时通知被回复的人 */
export async function notifyPostReply(args: {
  postId: string;
  commentId: string;
  parentCommentId?: string | null;
  actorId: string;
}) {
  try {
    const [post, actor] = await Promise.all([
      prisma.post.findUnique({
        where: { id: args.postId },
        select: { authorId: true, title: true },
      }),
      actorDisplay(args.actorId),
    ]);
    if (!post || !actor) return;

    await emitNotification({
      recipientId: post.authorId,
      actorId: args.actorId,
      type: "POST_REPLY",
      title: `${actor.name} 评论了你的帖子`,
      body: post.title,
      link: `/post/${args.postId}#comment-${args.commentId}`,
      targetType: "POST",
      targetId: args.postId,
    });

    if (args.parentCommentId) {
      const parent = await prisma.comment.findUnique({
        where: { id: args.parentCommentId },
        select: { authorId: true, content: true, postId: true },
      });
      if (parent && parent.authorId !== post.authorId) {
        await emitNotification({
          recipientId: parent.authorId,
          actorId: args.actorId,
          type: "COMMENT_REPLY",
          title: `${actor.name} 回复了你的评论`,
          body: parent.content.slice(0, 80),
          link: `/post/${args.postId}#comment-${args.commentId}`,
          targetType: "COMMENT",
          targetId: args.parentCommentId,
        });
      }
    }
  } catch (err) {
    console.error("[notifications] notifyPostReply", err);
  }
}

/** 被关注 → 通知被关注的人 */
export async function notifyFollow(args: {
  followingId: string;
  actorId: string;
}) {
  try {
    const actor = await actorDisplay(args.actorId);
    if (!actor) return;
    await emitNotification({
      recipientId: args.followingId,
      actorId: args.actorId,
      type: "FOLLOW",
      title: `${actor.name} 关注了你`,
      body: null,
      link: `/profile/${args.actorId}`,
      targetType: "USER",
      targetId: args.actorId,
    });
  } catch (err) {
    console.error("[notifications] notifyFollow", err);
  }
}

/** Stage 10.2：订单付款成功 → 通知买家 */
export async function notifyOrderPaid(args: {
  buyerId: string;
  orderNo: string;
  amountCents: number;
  currency: string;
  /** 已格式化的金额（带 ¥），调用方计算后传入，避免把 commerce 工具下推到 emit。 */
  amountDisplay: string;
}) {
  try {
    void args.amountCents;
    void args.currency;
    await emitNotification({
      recipientId: args.buyerId,
      actorId: null,
      type: "ORDER_PAID",
      title: `订单付款成功`,
      body: `订单 ${args.orderNo} · ${args.amountDisplay}`,
      link: `/checkout/${args.orderNo}`,
      targetType: "ORDER",
      targetId: args.orderNo,
    });
  } catch (err) {
    console.error("[notifications] notifyOrderPaid", err);
  }
}

/** Stage 10.4：订单退款成功 → 通知买家 */
export async function notifyOrderRefunded(args: {
  buyerId: string;
  orderNo: string;
  refundCents: number;
  currency: string;
  /** 已格式化的金额（带 ¥）。 */
  refundDisplay: string;
  /** 是否全额退款；用于标题区分文案。 */
  fullyRefunded: boolean;
}) {
  try {
    void args.refundCents;
    void args.currency;
    await emitNotification({
      recipientId: args.buyerId,
      actorId: null,
      type: "ORDER_REFUNDED",
      title: args.fullyRefunded
        ? `订单已全额退款`
        : `订单已部分退款`,
      body: `订单 ${args.orderNo} · 退款 ${args.refundDisplay}`,
      link: `/me/orders`,
      targetType: "ORDER",
      targetId: args.orderNo,
    });
  } catch (err) {
    console.error("[notifications] notifyOrderRefunded", err);
  }
}

/** Stage 10.2：工作流商品被买入 → 通知卖家 */
export async function notifyWorkflowSold(args: {
  sellerId: string;
  itemTitle: string;
  orderNo: string;
  amountDisplay: string;
}) {
  try {
    await emitNotification({
      recipientId: args.sellerId,
      actorId: null,
      type: "WORKFLOW_SOLD",
      title: `你的工作流被购买`,
      body: `${args.itemTitle} · ${args.amountDisplay}`,
      link: `/me/workflows`,
      targetType: "ORDER",
      targetId: args.orderNo,
    });
  } catch (err) {
    console.error("[notifications] notifyWorkflowSold", err);
  }
}

/** Stage 10.5：结算单冷藏期结束 → 通知卖家可申请提现。聚合按 sellerId 发一条。 */
export async function notifyPayoutAvailable(args: {
  sellerId: string;
  count: number;
  netCents: number;
  currency: string;
}) {
  try {
    const symbol = args.currency === "CNY" ? "¥" : args.currency + " ";
    const display = `${symbol}${(args.netCents / 100).toFixed(2)}`;
    await emitNotification({
      recipientId: args.sellerId,
      actorId: null,
      type: "PAYOUT_AVAILABLE",
      title: `结算单已可申请提现`,
      body: `${args.count} 笔订单 · 合计 ${display}`,
      link: `/me/earnings`,
      targetType: "PAYOUT",
      targetId: null,
    });
  } catch (err) {
    console.error("[notifications] notifyPayoutAvailable", err);
  }
}

/** Stage 10.5：admin 标记结算单已打款 → 通知卖家。 */
export async function notifyPayoutPaid(args: {
  sellerId: string;
  netCents: number;
  currency: string;
}) {
  try {
    const symbol = args.currency === "CNY" ? "¥" : args.currency + " ";
    const display = `${symbol}${(args.netCents / 100).toFixed(2)}`;
    await emitNotification({
      recipientId: args.sellerId,
      actorId: null,
      type: "PAYOUT_PAID",
      title: `结算款项已打款`,
      body: `本笔结算 ${display} 已完成打款，请查收`,
      link: `/me/earnings`,
      targetType: "PAYOUT",
      targetId: null,
    });
  } catch (err) {
    console.error("[notifications] notifyPayoutPaid", err);
  }
}

/** Stage 11.1：被邀请加入企业 → 通知被邀请人 */
export async function notifyOrgInvite(args: {
  inviteeId: string;
  inviterId: string;
  organizationName: string;
  organizationSlug: string;
}) {
  try {
    const inviter = await actorDisplay(args.inviterId);
    if (!inviter) return;
    await emitNotification({
      recipientId: args.inviteeId,
      actorId: args.inviterId,
      type: "ORG_INVITE",
      title: `${inviter.name} 邀请你加入 ${args.organizationName}`,
      body: null,
      link: `/me/organizations/invites`,
      targetType: "ORGANIZATION",
      targetId: args.organizationSlug,
    });
  } catch (err) {
    console.error("[notifications] notifyOrgInvite", err);
  }
}

/** Stage 11.1：邀请被接受 / 拒绝 → 通知邀请人 */
export async function notifyOrgInviteResponse(args: {
  inviterId: string;
  responderId: string;
  organizationName: string;
  organizationSlug: string;
  accepted: boolean;
}) {
  try {
    const responder = await actorDisplay(args.responderId);
    if (!responder) return;
    await emitNotification({
      recipientId: args.inviterId,
      actorId: args.responderId,
      type: "ORG_INVITE_RESPONSE",
      title: args.accepted
        ? `${responder.name} 已接受加入 ${args.organizationName}`
        : `${responder.name} 拒绝了加入 ${args.organizationName}`,
      body: null,
      link: `/organizations/${args.organizationSlug}/members`,
      targetType: "ORGANIZATION",
      targetId: args.organizationSlug,
    });
  } catch (err) {
    console.error("[notifications] notifyOrgInviteResponse", err);
  }
}

/** Stage 11.2：企业认证通过 → 通知申请人（owner） */
export async function notifyOrgVerificationApproved(args: {
  recipientId: string;
  organizationName: string;
  organizationSlug: string;
  reviewNote?: string | null;
}) {
  try {
    await emitNotification({
      recipientId: args.recipientId,
      actorId: null,
      type: "ORG_VERIFICATION_APPROVED",
      title: `企业「${args.organizationName}」认证已通过`,
      body: args.reviewNote ?? null,
      link: `/organizations/${args.organizationSlug}`,
      targetType: "ORGANIZATION",
      targetId: args.organizationSlug,
    });
  } catch (err) {
    console.error("[notifications] notifyOrgVerificationApproved", err);
  }
}

/** Stage 11.2：企业认证驳回 → 通知申请人，body 含驳回原因 */
export async function notifyOrgVerificationRejected(args: {
  recipientId: string;
  organizationName: string;
  organizationSlug: string;
  reviewNote: string;
}) {
  try {
    await emitNotification({
      recipientId: args.recipientId,
      actorId: null,
      type: "ORG_VERIFICATION_REJECTED",
      title: `企业「${args.organizationName}」认证未通过`,
      body: args.reviewNote,
      link: `/organizations/${args.organizationSlug}/settings`,
      targetType: "ORGANIZATION",
      targetId: args.organizationSlug,
    });
  } catch (err) {
    console.error("[notifications] notifyOrgVerificationRejected", err);
  }
}

/** Stage 11.1：被企业移除 → 通知被移除人 */
export async function notifyOrgMemberRemoved(args: {
  memberId: string;
  actorId: string;
  organizationName: string;
  organizationSlug: string;
}) {
  try {
    await emitNotification({
      recipientId: args.memberId,
      actorId: args.actorId,
      type: "ORG_MEMBER_REMOVED",
      title: `你已被移出 ${args.organizationName}`,
      body: null,
      link: `/organizations/${args.organizationSlug}`,
      targetType: "ORGANIZATION",
      targetId: args.organizationSlug,
    });
  } catch (err) {
    console.error("[notifications] notifyOrgMemberRemoved", err);
  }
}

/**
 * Stage 12.4：消息通知统一入口。
 * - 1v1：收件人收到一条 MESSAGE 类型通知。
 * - 群聊：mentioned 的成员收到 MENTION（高优先），其它非发送者收到 GROUP_MESSAGE；
 *   短窗口（5min）内的同会话同 actor → 同收件人通知去重，避免群里连发刷屏。
 * - 任意类型：mutedUntil > now 的参与者跳过（badge/Bell 都不响）。
 * - mentions 由调用方解析过；这里只挑会话内 username 命中且非发送者的人。
 */
export async function notifyMessage(args: {
  conversationId: string;
  messageId: string;
  actorId: string;
  preview: string;
  /** @username 列表（不含 @ 前缀），由调用方解析；空 = 无 @mention。 */
  mentions?: string[];
}) {
  try {
    const [conversation, participants, actor] = await Promise.all([
      prisma.conversation.findUnique({
        where: { id: args.conversationId },
        select: { isGroup: true, title: true },
      }),
      prisma.conversationParticipant.findMany({
        where: { conversationId: args.conversationId },
        select: {
          userId: true,
          mutedUntil: true,
          user: { select: { username: true } },
        },
      }),
      actorDisplay(args.actorId),
    ]);
    if (!actor || !conversation) return;

    const now = new Date();
    const eligible = participants.filter(
      (p) =>
        p.userId !== args.actorId &&
        (p.mutedUntil === null || p.mutedUntil <= now),
    );

    if (eligible.length === 0) return;

    const mentions = (args.mentions ?? []).map((m) => m.toLowerCase());
    const mentionedSet = new Set(
      eligible
        .filter((p) => mentions.includes(p.user.username.toLowerCase()))
        .map((p) => p.userId),
    );

    const preview = args.preview.slice(0, 80);
    const channelTitle =
      conversation.isGroup && conversation.title
        ? conversation.title
        : null;

    if (!conversation.isGroup) {
      await Promise.all(
        eligible.map((p) =>
          emitNotification({
            recipientId: p.userId,
            actorId: args.actorId,
            type: "MESSAGE",
            title: `${actor.name} 给你发了一条私信`,
            body: preview,
            link: `/messages/${args.conversationId}`,
            targetType: "CONVERSATION",
            targetId: args.conversationId,
          }),
        ),
      );
      return;
    }

    const since = new Date(now.getTime() - GROUP_MESSAGE_DEDUP_WINDOW_MS);

    await Promise.all(
      eligible.map(async (p) => {
        if (mentionedSet.has(p.userId)) {
          await emitNotification({
            recipientId: p.userId,
            actorId: args.actorId,
            type: "MENTION",
            title: channelTitle
              ? `${actor.name} 在「${channelTitle}」@了你`
              : `${actor.name} @了你`,
            body: preview,
            link: `/messages/${args.conversationId}#message-${args.messageId}`,
            targetType: "CONVERSATION",
            targetId: args.conversationId,
          });
          return;
        }
        // 群聊普通消息：短窗口内同 actor → 同收件人只推一条
        const existing = await prisma.notification.findFirst({
          where: {
            userId: p.userId,
            actorId: args.actorId,
            type: "GROUP_MESSAGE",
            targetType: "CONVERSATION",
            targetId: args.conversationId,
            createdAt: { gte: since },
          },
          select: { id: true },
        });
        if (existing) return;
        await emitNotification({
          recipientId: p.userId,
          actorId: args.actorId,
          type: "GROUP_MESSAGE",
          title: channelTitle
            ? `${actor.name} 在「${channelTitle}」发了新消息`
            : `${actor.name} 在群聊里发了新消息`,
          body: preview,
          link: `/messages/${args.conversationId}`,
          targetType: "CONVERSATION",
          targetId: args.conversationId,
        });
      }),
    );
  } catch (err) {
    console.error("[notifications] notifyMessage", err);
  }
}
