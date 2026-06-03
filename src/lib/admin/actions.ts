"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guard";
import { createAuditLog } from "@/lib/admin/audit";
import {
  COLLAB_STATUS_VALUES,
  type CollabStatusValue,
} from "@/lib/collaborations/categories";
import {
  TOOL_CATEGORY_VALUES,
  TOOL_PRICING_VALUES,
  type ToolCategoryValue,
  type ToolPricingValue,
} from "@/lib/tools/categories";

// 阶段 11 → Stage 5 扩展：管理后台写操作 + 审计日志。
// 所有 action 都先 requireAdmin —— 普通用户即使猜到表单地址也会被踢去登录。
// 每一次成功的变更都写入 AuditLog（IP / UA 走 getClientMeta）。

export async function adminDeletePost(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;
  const snapshot = await prisma.post
    .findUnique({
      where: { id },
      select: { title: true, authorId: true, channelId: true },
    })
    .catch(() => null);
  const deleted = await prisma.post
    .delete({ where: { id } })
    .then(() => true)
    .catch(() => false);
  if (deleted) {
    await createAuditLog({
      adminId: admin.id,
      action: "DELETE_POST",
      targetType: "Post",
      targetId: id,
      metadata: snapshot
        ? {
            title: snapshot.title,
            authorId: snapshot.authorId,
            channelId: snapshot.channelId,
          }
        : null,
    });
  }
  revalidatePath("/admin/posts");
  revalidatePath("/admin");
  revalidatePath("/community");
}

export async function adminDeleteWork(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;
  const snapshot = await prisma.work
    .findUnique({
      where: { id },
      select: { title: true, authorId: true },
    })
    .catch(() => null);
  const deleted = await prisma.work
    .delete({ where: { id } })
    .then(() => true)
    .catch(() => false);
  if (deleted) {
    await createAuditLog({
      adminId: admin.id,
      action: "DELETE_WORK",
      targetType: "Work",
      targetId: id,
      metadata: snapshot
        ? { title: snapshot.title, authorId: snapshot.authorId }
        : null,
    });
  }
  revalidatePath("/admin/works");
  revalidatePath("/admin");
  revalidatePath("/showcase");
}

export async function adminUpdateCollabStatus(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get("id");
  const status = formData.get("status");
  if (typeof id !== "string" || !id) return;
  if (typeof status !== "string") return;
  if (!(COLLAB_STATUS_VALUES as readonly string[]).includes(status)) return;
  await prisma.collaboration
    .update({
      where: { id },
      data: { status: status as CollabStatusValue },
    })
    .catch(() => null);
  revalidatePath("/admin/collaborations");
  revalidatePath("/collaboration");
  revalidatePath(`/collaboration/${id}`);
}

export async function adminDeleteCollab(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;
  const snapshot = await prisma.collaboration
    .findUnique({
      where: { id },
      select: { title: true, authorId: true, status: true },
    })
    .catch(() => null);
  const deleted = await prisma.collaboration
    .delete({ where: { id } })
    .then(() => true)
    .catch(() => false);
  if (deleted) {
    await createAuditLog({
      adminId: admin.id,
      action: "DELETE_COLLAB",
      targetType: "Collaboration",
      targetId: id,
      metadata: snapshot
        ? {
            title: snapshot.title,
            authorId: snapshot.authorId,
            statusBefore: snapshot.status,
          }
        : null,
    });
  }
  revalidatePath("/admin/collaborations");
  revalidatePath("/admin");
  revalidatePath("/collaboration");
}

export async function adminDeleteTool(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;
  const snapshot = await prisma.tool
    .findUnique({ where: { id }, select: { name: true, slug: true } })
    .catch(() => null);
  const deleted = await prisma.tool
    .delete({ where: { id } })
    .then(() => true)
    .catch(() => false);
  if (deleted) {
    await createAuditLog({
      adminId: admin.id,
      action: "DELETE_TOOL",
      targetType: "Tool",
      targetId: id,
      metadata: snapshot ? { name: snapshot.name, slug: snapshot.slug } : null,
    });
  }
  revalidatePath("/admin/tools");
  revalidatePath("/admin");
  revalidatePath("/tools");
}

/** Admin 删除评论（评论详情页 / 帖子页 admin 视角）。 */
export async function adminDeleteComment(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;
  const snapshot = await prisma.comment
    .findUnique({
      where: { id },
      select: {
        postId: true,
        authorId: true,
        parentId: true,
        content: true,
      },
    })
    .catch(() => null);
  if (!snapshot) return;
  const ok = await prisma
    .$transaction([
      prisma.comment.delete({ where: { id } }),
      prisma.post.update({
        where: { id: snapshot.postId },
        data: { commentCount: { decrement: 1 } },
      }),
    ])
    .then(() => true)
    .catch(() => false);
  if (ok) {
    await createAuditLog({
      adminId: admin.id,
      action: "DELETE_COMMENT",
      targetType: "Comment",
      targetId: id,
      metadata: {
        postId: snapshot.postId,
        authorId: snapshot.authorId,
        parentId: snapshot.parentId,
        contentSnippet: snapshot.content.slice(0, 120),
      },
    });
    revalidatePath(`/post/${snapshot.postId}`);
  }
}

// 简单的 slug 生成：英文转 kebab-case，其他字符直接退化成随机后缀
function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (base.length >= 2) return base;
  // 中文名 / 全是符号时，回退到时间戳后缀
  return `tool-${Date.now().toString(36)}`;
}

export type AdminCreateToolState = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export async function adminCreateTool(
  _state: AdminCreateToolState | undefined,
  formData: FormData,
): Promise<AdminCreateToolState> {
  const admin = await requireAdmin();

  const name = (formData.get("name") ?? "").toString().trim();
  const description = (formData.get("description") ?? "").toString().trim();
  const url = (formData.get("url") ?? "").toString().trim();
  const category = (formData.get("category") ?? "").toString().trim();
  const pricing = (formData.get("pricing") ?? "FREE").toString().trim();
  const useCase = (formData.get("useCase") ?? "").toString().trim();
  const tagsRaw = (formData.get("tags") ?? "").toString();
  const isOfficial = formData.get("isOfficial") === "on";

  const fieldErrors: Record<string, string[]> = {};
  if (!name) fieldErrors.name = ["请输入工具名称"];
  if (!description) fieldErrors.description = ["请输入工具描述"];
  if (!url) fieldErrors.url = ["请输入官网/链接"];
  if (!(TOOL_CATEGORY_VALUES as readonly string[]).includes(category)) {
    fieldErrors.category = ["分类不合法"];
  }
  if (!(TOOL_PRICING_VALUES as readonly string[]).includes(pricing)) {
    fieldErrors.pricing = ["计费类型不合法"];
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  const tags = tagsRaw
    .split(/[,，\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);

  // slug 唯一性：撞了就追加后缀
  let slug = slugify(name);
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.tool.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!exists) break;
    slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;
  }

  try {
    await prisma.tool.create({
      data: {
        slug,
        name,
        description,
        url,
        category: category as ToolCategoryValue,
        pricing: pricing as ToolPricingValue,
        useCase: useCase || null,
        tags,
        isOfficial,
        createdById: admin.id,
        logoUrl: `https://api.dicebear.com/9.x/icons/svg?seed=${encodeURIComponent(slug)}`,
      },
    });
  } catch {
    return { ok: false, message: "新增失败，可能 slug 冲突，请改个名字重试" };
  }

  revalidatePath("/admin/tools");
  revalidatePath("/admin");
  revalidatePath("/tools");
  return { ok: true, message: "已添加" };
}
