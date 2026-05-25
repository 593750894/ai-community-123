"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { CreateCommentSchema } from "@/lib/comments/schemas";

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

  const parsed = CreateCommentSchema.safeParse({
    postId,
    content: formData.get("content"),
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

  await prisma.$transaction([
    prisma.comment.create({
      data: {
        postId: post.id,
        authorId: session.userId,
        content: parsed.data.content,
      },
    }),
    prisma.post.update({
      where: { id: post.id },
      data: { commentCount: { increment: 1 } },
    }),
  ]);

  revalidatePath(`/post/${post.id}`);
  revalidatePath(`/community/${post.channelId}`);

  return {
    ok: true,
    resetKey: (prev?.resetKey ?? 0) + 1,
  };
}
