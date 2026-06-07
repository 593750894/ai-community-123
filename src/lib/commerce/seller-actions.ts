"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/guard";
import { AppError } from "@/lib/errors";

import {
  createWorkflowItem,
  deleteWorkflowItem,
  transitionWorkflowItemStatus,
  updateWorkflowItem,
} from "./actions";
import { CreateWorkflowItemSchema, UpdateWorkflowItemSchema } from "./schemas";

/**
 * Server Actions（与 form action 直接绑定）。
 * 与 src/lib/commerce/actions.ts 区分：actions.ts 是纯业务函数（API/test 友好），
 * 这里是 form 适配层 —— 解析 FormData、要鉴权、回 useActionState 形态。
 */

export interface SellerActionState {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
}

function parseFormPayload(formData: FormData) {
  const get = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v.trim() : "";
  };
  const priceYuan = Number(get("priceYuan"));
  // 用元输入更友好，落库还是分；schema priceCents 是分。
  const priceCents = Number.isFinite(priceYuan)
    ? Math.max(0, Math.floor(priceYuan * 100 + 0.5))
    : 0;

  const tagsRaw = get("tags");
  const toolStackRaw = get("toolStack");
  const tags = tagsRaw
    ? tagsRaw.split(/[,，]/).map((t) => t.trim()).filter(Boolean)
    : [];
  const toolStack = toolStackRaw
    ? toolStackRaw.split(/[,，]/).map((t) => t.trim()).filter(Boolean)
    : [];

  return {
    title: get("title"),
    description: get("description"),
    coverUrl: get("coverUrl") || null,
    downloadUrl: get("downloadUrl") || null,
    priceCents,
    currency: "CNY" as const,
    category: get("category"),
    tags,
    toolStack,
    organizationId: get("organizationId") || null,
  };
}

export async function createWorkflowItemAction(
  _prev: SellerActionState,
  formData: FormData,
): Promise<SellerActionState> {
  const user = await requireUser("/me/workflows/new");
  const raw = parseFormPayload(formData);
  const parsed = CreateWorkflowItemSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "请检查表单",
      fieldErrors: parsed.error.flatten().fieldErrors as SellerActionState["fieldErrors"],
    };
  }
  let createdId: string;
  try {
    const result = await createWorkflowItem(parsed.data, user.id);
    createdId = result.id;
  } catch (err) {
    return { ok: false, message: appErrorMessage(err) };
  }
  revalidatePath("/me/workflows");
  redirect(`/me/workflows/${createdId}/edit?created=1`);
}

export async function updateWorkflowItemAction(
  _prev: SellerActionState,
  formData: FormData,
): Promise<SellerActionState> {
  const id = String(formData.get("id") || "");
  if (!id) return { ok: false, message: "缺少商品 ID" };
  const user = await requireUser(`/me/workflows/${id}/edit`);
  const raw = parseFormPayload(formData);
  const parsed = UpdateWorkflowItemSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "请检查表单",
      fieldErrors: parsed.error.flatten().fieldErrors as SellerActionState["fieldErrors"],
    };
  }
  try {
    await updateWorkflowItem(id, parsed.data, user.id);
  } catch (err) {
    return { ok: false, message: appErrorMessage(err) };
  }
  revalidatePath("/me/workflows");
  revalidatePath(`/me/workflows/${id}/edit`);
  revalidatePath(`/marketplace/${id}`);
  return { ok: true, message: "已保存" };
}

export async function transitionWorkflowItemStatusAction(
  formData: FormData,
): Promise<void> {
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  if (!id) return;
  const user = await requireUser("/me/workflows");
  try {
    await transitionWorkflowItemStatus(
      id,
      { status: status as "DRAFT" | "PUBLISHED" | "ARCHIVED" },
      user.id,
    );
  } catch {
    // 业务异常静默吞掉，列表 revalidate 后用户自然看到状态没变；
    // 详情页操作通过 update 表单走完整错误回显。
  }
  revalidatePath("/me/workflows");
  revalidatePath(`/me/workflows/${id}/edit`);
  revalidatePath(`/marketplace/${id}`);
  revalidatePath("/marketplace");
}

export async function deleteWorkflowItemAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") || "");
  if (!id) return;
  const user = await requireUser("/me/workflows");
  try {
    await deleteWorkflowItem(id, user.id);
  } catch {
    // 同上 — 失败保留商品。
  }
  revalidatePath("/me/workflows");
}

function appErrorMessage(err: unknown): string {
  if (err instanceof AppError) return err.message;
  return "操作失败，请稍后再试";
}
