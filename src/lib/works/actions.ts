"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { CreateWorkSchema } from "@/lib/works/schemas";
import type { WorkCategory } from "@/generated/prisma/client";

export type CreateWorkFormState = {
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

export async function createWorkAction(
  _state: CreateWorkFormState | undefined,
  formData: FormData,
): Promise<CreateWorkFormState> {
  const session = await getSession();
  if (!session) {
    return { ok: false, message: "请先登录后再发布作品" };
  }

  const parsed = CreateWorkSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    thumbnailUrl: formData.get("thumbnailUrl"),
    videoUrl: formData.get("videoUrl"),
    category: formData.get("category"),
    tools: formData.get("tools"),
  });

  if (!parsed.success) {
    return { ok: false, fieldErrors: flattenZodError(parsed.error) };
  }

  const { title, description, thumbnailUrl, videoUrl, category, tools } =
    parsed.data;

  const created = await prisma.work.create({
    data: {
      authorId: session.userId,
      title,
      description,
      thumbnailUrl,
      videoUrl,
      category: category as WorkCategory,
      tools,
    },
    select: { id: true },
  });

  revalidatePath("/showcase");
  redirect(`/showcase/${created.id}`);
}
