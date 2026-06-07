"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import {
  AppError,
  ValidationError,
} from "@/lib/errors";
import {
  AddGroupMembersSchema,
  CreateConversationSchema,
  UpdateGroupConversationSchema,
  UpdateGroupMemberRoleSchema,
} from "@/lib/messages/schemas";
import {
  addGroupMembers,
  createGroupConversation,
  deleteGroupConversation,
  leaveGroupConversation,
  removeGroupMember,
  updateGroupConversation,
  updateGroupMemberRole,
} from "@/lib/messages/groups";

export type GroupFormState = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

function flattenZodError(error: ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!result[key]) result[key] = [];
    result[key].push(issue.message);
  }
  return result;
}

function toErrorState(err: unknown): GroupFormState {
  if (err instanceof AppError) {
    return {
      ok: false,
      message: err.message,
      fieldErrors:
        err.details && typeof err.details === "object"
          ? (err.details as Record<string, string[]>)
          : undefined,
    };
  }
  console.error("[group-actions] unexpected", err);
  return { ok: false, message: "服务器内部错误，请稍后再试" };
}

const USERNAME_RE = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * 把 "alice, bob@artist" 之类的输入解析成「username 数组」。
 * 接受换行 / 逗号 / 全角逗号分隔，允许带 @ 前缀。
 */
function parseUsernameInput(raw: string): string[] {
  return raw
    .split(/[\n,，;；]/)
    .map((s) => s.trim().replace(/^@+/, ""))
    .filter(Boolean);
}

/**
 * 把 username 列表批量解析成 userId 列表。
 * 任何 username 找不到都抛 ValidationError 并把缺失的列表挂在 fieldErrors。
 */
async function resolveUsernamesToIds(
  usernames: string[],
  excludeUserId?: string,
): Promise<string[]> {
  if (usernames.length === 0) {
    throw new ValidationError("请至少输入一个用户名", {
      members: ["请至少输入一个用户名"],
    });
  }
  const badFormat = usernames.filter((u) => !USERNAME_RE.test(u));
  if (badFormat.length > 0) {
    throw new ValidationError("用户名格式不合法", {
      members: badFormat.map((u) => `用户名格式不合法：${u}`),
    });
  }
  // 大小写不敏感匹配（pg 用 ILIKE 等价 mode insensitive）
  const users = await prisma.user.findMany({
    where: { username: { in: usernames, mode: "insensitive" } },
    select: { id: true, username: true, status: true },
  });
  const usernameToId = new Map<string, string>();
  for (const u of users) {
    if (u.status === "ACTIVE") {
      usernameToId.set(u.username.toLowerCase(), u.id);
    }
  }
  const missing = usernames.filter(
    (u) => !usernameToId.has(u.toLowerCase()),
  );
  if (missing.length > 0) {
    throw new ValidationError("找不到用户", {
      members: missing.map((u) => `找不到用户：${u}`),
    });
  }
  const ids = Array.from(new Set(usernames.map((u) => usernameToId.get(u.toLowerCase())!)));
  if (excludeUserId) {
    return ids.filter((id) => id !== excludeUserId);
  }
  return ids;
}

// ─────────────────────────────────────────────────────────────
// 创建群聊
// ─────────────────────────────────────────────────────────────

export async function createGroupConversationAction(
  _prev: GroupFormState | undefined,
  formData: FormData,
): Promise<GroupFormState> {
  const session = await getSession();
  if (!session) {
    return { ok: false, message: "请先登录后再创建群聊" };
  }
  const title = String(formData.get("title") ?? "");
  const avatarUrl = String(formData.get("avatarUrl") ?? "");
  const membersRaw = String(formData.get("members") ?? "");

  let memberIds: string[];
  try {
    memberIds = await resolveUsernamesToIds(
      parseUsernameInput(membersRaw),
      session.userId,
    );
  } catch (err) {
    return toErrorState(err);
  }

  const parsed = CreateConversationSchema.safeParse({
    isGroup: true,
    title,
    avatarUrl,
    memberIds,
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: flattenZodError(parsed.error) };
  }
  if (parsed.data.isGroup !== true) {
    return { ok: false, message: "参数校验失败" };
  }

  let conversationId: string;
  try {
    const { id } = await createGroupConversation(session.userId, {
      title: parsed.data.title,
      avatarUrl: parsed.data.avatarUrl ?? null,
      memberIds: parsed.data.memberIds,
    });
    conversationId = id;
  } catch (err) {
    return toErrorState(err);
  }

  revalidatePath("/messages");
  redirect(`/messages/${conversationId}`);
}

// ─────────────────────────────────────────────────────────────
// 群信息编辑
// ─────────────────────────────────────────────────────────────

export async function updateGroupConversationAction(
  _prev: GroupFormState | undefined,
  formData: FormData,
): Promise<GroupFormState> {
  const session = await getSession();
  if (!session) {
    return { ok: false, message: "请先登录" };
  }
  const conversationId = String(formData.get("conversationId") ?? "");
  if (!conversationId) {
    return { ok: false, message: "缺少会话 ID" };
  }
  const titleRaw = formData.get("title");
  const avatarRaw = formData.get("avatarUrl");
  const input: { title?: string; avatarUrl?: string | null } = {};
  if (titleRaw !== null) input.title = String(titleRaw);
  if (avatarRaw !== null) input.avatarUrl = String(avatarRaw);

  const parsed = UpdateGroupConversationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: flattenZodError(parsed.error) };
  }

  try {
    await updateGroupConversation(session.userId, conversationId, parsed.data);
  } catch (err) {
    return toErrorState(err);
  }

  revalidatePath(`/messages/${conversationId}/settings`);
  revalidatePath(`/messages/${conversationId}`);
  revalidatePath("/messages");
  return { ok: true, message: "群聊信息已更新" };
}

// ─────────────────────────────────────────────────────────────
// 添加成员
// ─────────────────────────────────────────────────────────────

export async function addGroupMembersAction(
  _prev: GroupFormState | undefined,
  formData: FormData,
): Promise<GroupFormState> {
  const session = await getSession();
  if (!session) {
    return { ok: false, message: "请先登录" };
  }
  const conversationId = String(formData.get("conversationId") ?? "");
  if (!conversationId) {
    return { ok: false, message: "缺少会话 ID" };
  }
  const membersRaw = String(formData.get("members") ?? "");

  let memberIds: string[];
  try {
    memberIds = await resolveUsernamesToIds(
      parseUsernameInput(membersRaw),
      session.userId,
    );
  } catch (err) {
    return toErrorState(err);
  }

  const parsed = AddGroupMembersSchema.safeParse({ memberIds });
  if (!parsed.success) {
    return { ok: false, fieldErrors: flattenZodError(parsed.error) };
  }

  try {
    const result = await addGroupMembers(
      session.userId,
      conversationId,
      parsed.data,
    );
    revalidatePath(`/messages/${conversationId}/settings`);
    revalidatePath(`/messages/${conversationId}`);
    revalidatePath("/messages");
    const msg =
      result.added.length > 0
        ? `已添加 ${result.added.length} 位成员${result.skipped.length > 0 ? `（${result.skipped.length} 位已在群内被跳过）` : ""}`
        : "所有成员已在群内";
    return { ok: true, message: msg };
  } catch (err) {
    return toErrorState(err);
  }
}

// ─────────────────────────────────────────────────────────────
// 单成员操作（角色 / 移除 / 退出 / 解散）
// 都做成 FormData 入口，方便与原生 form action 绑定。
// ─────────────────────────────────────────────────────────────

export async function updateGroupMemberRoleAction(
  formData: FormData,
): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/auth/login");
  const conversationId = String(formData.get("conversationId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");
  const parsed = UpdateGroupMemberRoleSchema.safeParse({ role });
  if (!parsed.success || !conversationId || !userId) return;
  try {
    await updateGroupMemberRole(
      session.userId,
      conversationId,
      userId,
      parsed.data,
    );
  } catch (err) {
    console.warn("[group-actions] updateRole", err);
  }
  revalidatePath(`/messages/${conversationId}/settings`);
}

export async function removeGroupMemberAction(
  formData: FormData,
): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/auth/login");
  const conversationId = String(formData.get("conversationId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  if (!conversationId || !userId) return;
  try {
    await removeGroupMember(session.userId, conversationId, userId);
  } catch (err) {
    console.warn("[group-actions] removeMember", err);
  }
  revalidatePath(`/messages/${conversationId}/settings`);
  revalidatePath(`/messages/${conversationId}`);
}

export async function leaveGroupConversationAction(
  formData: FormData,
): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/auth/login");
  const conversationId = String(formData.get("conversationId") ?? "");
  if (!conversationId) return;
  try {
    await leaveGroupConversation(session.userId, conversationId);
  } catch (err) {
    console.warn("[group-actions] leave", err);
    revalidatePath(`/messages/${conversationId}/settings`);
    return;
  }
  revalidatePath("/messages");
  redirect("/messages");
}

export async function deleteGroupConversationAction(
  formData: FormData,
): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/auth/login");
  const conversationId = String(formData.get("conversationId") ?? "");
  if (!conversationId) return;
  try {
    await deleteGroupConversation(session.userId, conversationId);
  } catch (err) {
    console.warn("[group-actions] delete", err);
    revalidatePath(`/messages/${conversationId}/settings`);
    return;
  }
  revalidatePath("/messages");
  redirect("/messages");
}
