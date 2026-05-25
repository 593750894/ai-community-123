"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { CreatePostSchema } from "@/lib/posts/schemas";
import type { PostType } from "@/generated/prisma/client";

export type CreatePostFormState = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
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

export async function createPostAction(
  _state: CreatePostFormState | undefined,
  formData: FormData,
): Promise<CreatePostFormState> {
  const session = await getSession();
  if (!session) {
    return { ok: false, message: "请先登录后再发帖" };
  }

  const parsed = CreatePostSchema.safeParse({
    channelId: formData.get("channelId"),
    type: formData.get("type"),
    title: formData.get("title"),
    content: formData.get("content"),
    videoUrl: formData.get("videoUrl"),
    imageUrl: formData.get("imageUrl"),
  });

  if (!parsed.success) {
    return { ok: false, fieldErrors: flattenZodError(parsed.error) };
  }

  const { channelId, type, title, content, videoUrl, imageUrl } = parsed.data;

  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { id: true },
  });
  if (!channel) {
    return {
      ok: false,
      fieldErrors: { channelId: ["该频道不存在"] },
    };
  }

  const created = await prisma.post.create({
    data: {
      channelId,
      authorId: session.userId,
      title,
      content,
      type: type as PostType,
      videoUrl,
      imageUrl,
    },
    select: { id: true, channelId: true },
  });

  revalidatePath(`/community/${created.channelId}`);
  revalidatePath("/community");
  redirect(`/community/${created.channelId}#post-${created.id}`);
}
