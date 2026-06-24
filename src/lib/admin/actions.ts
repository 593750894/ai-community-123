"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guard";
import { createAuditLog } from "@/lib/admin/audit";
import {
  softDeletePost,
  softDeleteWork,
  softDeleteCollaboration,
  softDeleteComment,
} from "@/lib/content/soft-delete";
import { ConflictError } from "@/lib/errors";
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

/**
 * Stage 17.2：admin 下架帖子改为软删除（写 deletedAt + 通知作者 + 审计）。
 * 内容仍保留在 DB；作者可在 /me/appeals 申诉。
 * 重复下架（已是 deletedAt 状态）被 softDeletePost 抛 ConflictError，这里吞掉转 no-op
 *   保留旧 form action 「点了就 revalidate」的语义。
 */
export async function adminDeletePost(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = formData.get("id");
  const reason = (formData.get("reason") ?? "").toString().trim() || null;
  if (typeof id !== "string" || !id) return;
  try {
    await softDeletePost(id, { actorId: admin.id, reason, source: "admin" });
  } catch (err) {
    if (!(err instanceof ConflictError)) throw err;
  }
  revalidatePath("/admin/posts");
  revalidatePath("/admin");
  revalidatePath("/community");
}

/** Stage 17.2：admin 下架作品改为软删除（参考 adminDeletePost）。 */
export async function adminDeleteWork(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = formData.get("id");
  const reason = (formData.get("reason") ?? "").toString().trim() || null;
  if (typeof id !== "string" || !id) return;
  try {
    await softDeleteWork(id, { actorId: admin.id, reason, source: "admin" });
  } catch (err) {
    if (!(err instanceof ConflictError)) throw err;
  }
  revalidatePath("/admin/works");
  revalidatePath("/admin");
  revalidatePath("/showcase");
}

export async function adminUpdateCollabStatus(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = formData.get("id");
  const status = formData.get("status");
  if (typeof id !== "string" || !id) return;
  if (typeof status !== "string") return;
  if (!(COLLAB_STATUS_VALUES as readonly string[]).includes(status)) return;
  const before = await prisma.collaboration
    .findUnique({ where: { id }, select: { status: true, title: true } })
    .catch(() => null);
  const updated = await prisma.collaboration
    .update({
      where: { id },
      data: { status: status as CollabStatusValue },
    })
    .then(() => true)
    .catch(() => false);
  if (updated) {
    await createAuditLog({
      adminId: admin.id,
      action: "UPDATE_COLLAB_STATUS",
      targetType: "Collaboration",
      targetId: id,
      metadata: before
        ? { title: before.title, statusBefore: before.status, statusAfter: status }
        : { statusAfter: status },
    });
  }
  revalidatePath("/admin/collaborations");
  revalidatePath("/collaboration");
  revalidatePath(`/collaboration/${id}`);
}

/** Stage 17.2：admin 下架合作改为软删除（参考 adminDeletePost）。 */
export async function adminDeleteCollab(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = formData.get("id");
  const reason = (formData.get("reason") ?? "").toString().trim() || null;
  if (typeof id !== "string" || !id) return;
  try {
    await softDeleteCollaboration(id, {
      actorId: admin.id,
      reason,
      source: "admin",
    });
  } catch (err) {
    if (!(err instanceof ConflictError)) throw err;
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

/** Stage 17.2：admin 下架评论改为软删除。
 *  软删除时 post.commentCount 在 softDeleteComment 内部 tx 一并 decrement。 */
export async function adminDeleteComment(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = formData.get("id");
  const reason = (formData.get("reason") ?? "").toString().trim() || null;
  if (typeof id !== "string" || !id) return;
  const snapshot = await prisma.comment
    .findUnique({ where: { id }, select: { postId: true } })
    .catch(() => null);
  try {
    await softDeleteComment(id, { actorId: admin.id, reason, source: "admin" });
  } catch (err) {
    if (!(err instanceof ConflictError)) throw err;
  }
  if (snapshot?.postId) {
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

  let createdId: string | null = null;
  try {
    const created = await prisma.tool.create({
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
      select: { id: true },
    });
    createdId = created.id;
  } catch {
    return { ok: false, message: "新增失败，可能 slug 冲突，请改个名字重试" };
  }

  if (createdId) {
    await createAuditLog({
      adminId: admin.id,
      action: "CREATE_TOOL",
      targetType: "Tool",
      targetId: createdId,
      metadata: { name, slug, category, pricing, isOfficial },
    });
  }

  revalidatePath("/admin/tools");
  revalidatePath("/admin");
  revalidatePath("/tools");
  return { ok: true, message: "已添加" };
}

// ─── Stage 9: 编辑工具 ─────────────────────────────────────────────
// slug 在 MVP 内不允许改：是 /tools/[slug] 唯一 routing key，没有 301 兜底。

export type AdminUpdateToolState = AdminCreateToolState;

export async function adminUpdateTool(
  _state: AdminUpdateToolState | undefined,
  formData: FormData,
): Promise<AdminUpdateToolState> {
  const admin = await requireAdmin();

  const id = (formData.get("id") ?? "").toString().trim();
  if (!id) return { ok: false, message: "缺少工具 ID" };

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

  const before = await prisma.tool
    .findUnique({
      where: { id },
      select: {
        name: true,
        description: true,
        url: true,
        category: true,
        pricing: true,
        useCase: true,
        tags: true,
        isOfficial: true,
        slug: true,
      },
    })
    .catch(() => null);
  if (!before) return { ok: false, message: "工具不存在或已被删除" };

  try {
    await prisma.tool.update({
      where: { id },
      data: {
        name,
        description,
        url,
        category: category as ToolCategoryValue,
        pricing: pricing as ToolPricingValue,
        useCase: useCase || null,
        tags,
        isOfficial,
      },
    });
  } catch {
    return { ok: false, message: "更新失败，请稍后重试" };
  }

  await createAuditLog({
    adminId: admin.id,
    action: "UPDATE_TOOL",
    targetType: "Tool",
    targetId: id,
    metadata: {
      slug: before.slug,
      before: {
        name: before.name,
        url: before.url,
        category: before.category,
        pricing: before.pricing,
        useCase: before.useCase,
        tags: before.tags,
        isOfficial: before.isOfficial,
      },
      after: { name, url, category, pricing, useCase: useCase || null, tags, isOfficial },
    },
  });

  revalidatePath("/admin/tools");
  revalidatePath("/admin");
  revalidatePath("/tools");
  revalidatePath(`/tools/${before.slug}`);
  return { ok: true, message: "已保存" };
}
