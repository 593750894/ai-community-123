"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guard";
import { createAuditLog } from "@/lib/admin/audit";

// Stage 9：admin 帖子置顶 / 锁定。
// 锁定后评论入口被 src/lib/comments/actions.ts 和
// src/app/api/posts/[postId]/comments/route.ts 拒绝。

async function loadPostSnapshot(id: string) {
  return prisma.post
    .findUnique({
      where: { id },
      select: { id: true, title: true, channelId: true, pinned: true, locked: true },
    })
    .catch(() => null);
}

function revalidatePostPaths(postId: string, channelId: string | null) {
  revalidatePath(`/post/${postId}`);
  revalidatePath("/community");
  if (channelId) {
    revalidatePath(`/community/${channelId}`);
  }
  revalidatePath("/admin/posts");
  revalidatePath("/admin");
}

export async function adminTogglePostPinned(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = formData.get("postId");
  const desired = formData.get("pinned");
  if (typeof id !== "string" || !id) return;
  if (typeof desired !== "string") return;
  const next = desired === "true";

  const snapshot = await loadPostSnapshot(id);
  if (!snapshot || snapshot.pinned === next) {
    if (snapshot) revalidatePostPaths(id, snapshot.channelId);
    return;
  }

  const ok = await prisma.post
    .update({ where: { id }, data: { pinned: next } })
    .then(() => true)
    .catch(() => false);
  if (ok) {
    await createAuditLog({
      adminId: admin.id,
      action: next ? "POST_PIN" : "POST_UNPIN",
      targetType: "Post",
      targetId: id,
      metadata: {
        title: snapshot.title,
        channelId: snapshot.channelId,
      },
    });
  }
  revalidatePostPaths(id, snapshot.channelId);
}

export async function adminTogglePostLocked(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = formData.get("postId");
  const desired = formData.get("locked");
  if (typeof id !== "string" || !id) return;
  if (typeof desired !== "string") return;
  const next = desired === "true";

  const snapshot = await loadPostSnapshot(id);
  if (!snapshot || snapshot.locked === next) {
    if (snapshot) revalidatePostPaths(id, snapshot.channelId);
    return;
  }

  const ok = await prisma.post
    .update({ where: { id }, data: { locked: next } })
    .then(() => true)
    .catch(() => false);
  if (ok) {
    await createAuditLog({
      adminId: admin.id,
      action: next ? "POST_LOCK" : "POST_UNLOCK",
      targetType: "Post",
      targetId: id,
      metadata: {
        title: snapshot.title,
        channelId: snapshot.channelId,
      },
    });
  }
  revalidatePostPaths(id, snapshot.channelId);
}
