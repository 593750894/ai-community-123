"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import {
  CreateCollaborationSchema,
  UpdateCollabStatusSchema,
} from "@/lib/collaborations/schemas";
import type {
  CollaborationCategory,
  CollaborationLocation,
  CollaborationStatus,
  CollaborationType,
  CollaborationWorkMode,
} from "@/generated/prisma/client";

export type CreateCollaborationFormState = {
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

export async function createCollaborationAction(
  _state: CreateCollaborationFormState | undefined,
  formData: FormData,
): Promise<CreateCollaborationFormState> {
  const session = await getSession();
  if (!session) {
    return { ok: false, message: "请先登录后再发布合作需求" };
  }

  const parsed = CreateCollaborationSchema.safeParse({
    category: formData.get("category"),
    type: formData.get("type") ?? "LOOKING_FOR",
    workMode: formData.get("workMode"),
    location: formData.get("location"),
    title: formData.get("title"),
    description: formData.get("description"),
    budget: formData.get("budget"),
    contact: formData.get("contact"),
    tags: formData.get("tags"),
  });

  if (!parsed.success) {
    return { ok: false, fieldErrors: flattenZodError(parsed.error) };
  }

  const {
    category,
    type,
    workMode,
    location,
    title,
    description,
    budget,
    contact,
    tags,
  } = parsed.data;

  const created = await prisma.collaboration.create({
    data: {
      authorId: session.userId,
      title,
      description,
      type: type as CollaborationType,
      category: category as CollaborationCategory,
      workMode: workMode as CollaborationWorkMode,
      location: location as CollaborationLocation,
      budget,
      contact,
      tags,
    },
    select: { id: true },
  });

  revalidatePath("/collaboration");
  redirect(`/collaboration/${created.id}`);
}

export async function updateCollaborationStatusAction(
  formData: FormData,
): Promise<void> {
  const session = await getSession();
  if (!session) return;

  const parsed = UpdateCollabStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) return;

  const existing = await prisma.collaboration.findUnique({
    where: { id: parsed.data.id },
    select: { authorId: true },
  });
  // 鉴权失败、不存在、非发布者 —— 都静默忽略，不暴露细节给非发布者
  if (!existing || existing.authorId !== session.userId) return;

  await prisma.collaboration.update({
    where: { id: parsed.data.id },
    data: { status: parsed.data.status as CollaborationStatus },
  });

  revalidatePath("/collaboration");
  revalidatePath(`/collaboration/${parsed.data.id}`);
}
