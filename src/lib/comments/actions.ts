"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { requireActiveUserById, SuspendedError } from "@/lib/auth/suspension";
import { CreateCommentSchema } from "@/lib/comments/schemas";
import { notifyPostReply } from "@/lib/notifications/emit";

export type CreateCommentFormState = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
  /** 用于前端在成功时清空 textarea。每次成功递增。 */
  resetKey?: number;
  /** 引导未登录用户回到登录页时回跳的目标。 */
  loginNext?: string;
};

function flattenZodError(
  error: import("zod").ZodError,
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!result[key]) result[key] = [];
    result[key].push(issue.message);
  }
  return result;
}

export async function createCommentAction(
  prev: CreateCommentFormState | undefined,
  formData: FormData,
): Promise<CreateCommentFormState> {
  const postId = String(formData.get("postId") ?? "");

  const session = await getSession();
  if (!session) {
    return {
      ok: false,
      message: "请先登录后再发表评论",
      loginNext: postId ? `/post/${postId}` : "/community",
    };
  }

  try {
    await requireActiveUserById(session.userId);
  } catch (err) {
    if (err instanceof SuspendedError) {
      return { ok: false, message: err.message };
    }
    throw err;
  }

  const rawParentId = formData.get("parentId");
  const parsed = CreateCommentSchema.safeParse({
    postId,
    content: formData.get("content"),
    parentId:
      typeof rawParentId === "string" && rawParentId.length > 0
        ? rawParentId
        : undefined,
  });

  if (!parsed.success) {
    return { ok: false, fieldErrors: flattenZodError(parsed.error) };
  }

  const post = await prisma.post.findUnique({
    where: { id: parsed.data.postId },
    select: { id: true, locked: true, channelId: true },
  });
  if (!post) {
    return { ok: false, message: "帖子不存在或已被删除" };
  }
  if (post.locked) {
    return { ok: false, message: "该帖子已被锁定，无法评论" };
  }

  const [comment] = await prisma.$transaction([
    prisma.comment.create({
      data: {
        postId: post.id,
        authorId: session.userId,
        content: parsed.data.content,
        parentId: parsed.data.parentId ?? null,
      },
      select: { id: true, parentId: true },
    }),
    prisma.post.update({
      where: { id: post.id },
      data: { commentCount: { increment: 1 } },
    }),
  ]);

  revalidatePath(`/post/${post.id}`);
  revalidatePath(`/community/${post.channelId}`);

  await notifyPostReply({
    postId: post.id,
    commentId: comment.id,
    parentCommentId: comment.parentId,
    actorId: session.userId,
  });

  return {
    ok: true,
    resetKey: (prev?.resetKey ?? 0) + 1,
  };
}
