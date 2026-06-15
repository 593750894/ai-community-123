"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/guard";
import { requireActiveUser, SuspendedError } from "@/lib/auth/suspension";
import { AppError } from "@/lib/errors";

import {
  cancelInvite,
  createOrganization,
  deleteOrganization,
  inviteMember,
  leaveOrganization,
  removeMember,
  respondToInvite,
  updateMemberRole,
  updateOrganization,
} from "./actions";
import {
  CreateOrganizationSchema,
  SubmitVerificationSchema,
  UpdateOrganizationSchema,
  type CreateOrganizationInput,
  type InviteAssignableRole,
} from "./schemas";
import {
  cancelOrgVerification,
  reviewOrgVerification,
  submitOrgVerification,
} from "./verification";

// Stage 11.1：与 form action 直接绑定的 Server Actions。复用 actions.ts 的业务函数。

export interface OrgActionState {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
}

function appErrorMessage(err: unknown): string {
  if (err instanceof AppError) return err.message;
  return "操作失败，请稍后再试";
}

function parseCreatePayload(formData: FormData): CreateOrganizationInput {
  const get = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v.trim() : "";
  };
  const industry = get("industry");
  const size = get("size");
  return {
    slug: get("slug").toLowerCase(),
    name: get("name"),
    description: get("description") || undefined,
    logo: get("logo") || undefined,
    website: get("website") || undefined,
    industry: industry ? (industry as CreateOrganizationInput["industry"]) : null,
    size: size ? (size as CreateOrganizationInput["size"]) : null,
    contactEmail: get("contactEmail") || undefined,
  } as CreateOrganizationInput;
}

export async function createOrganizationAction(
  _prev: OrgActionState,
  formData: FormData,
): Promise<OrgActionState> {
  const user = await requireUser("/me/organizations/new");
  try {
    await requireActiveUser(user);
  } catch (err) {
    if (err instanceof SuspendedError) return { ok: false, message: err.message };
    throw err;
  }
  const raw = parseCreatePayload(formData);
  const parsed = CreateOrganizationSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "请检查表单",
      fieldErrors: parsed.error.flatten().fieldErrors as OrgActionState["fieldErrors"],
    };
  }
  let createdSlug: string;
  try {
    const org = await createOrganization({ ownerId: user.id, input: parsed.data });
    createdSlug = org.slug;
  } catch (err) {
    return { ok: false, message: appErrorMessage(err) };
  }
  revalidatePath("/me/organizations");
  revalidatePath("/organizations");
  redirect(`/organizations/${createdSlug}/settings?created=1`);
}

export async function updateOrganizationAction(
  _prev: OrgActionState,
  formData: FormData,
): Promise<OrgActionState> {
  const id = String(formData.get("id") || "");
  const slug = String(formData.get("slug") || "");
  if (!id) return { ok: false, message: "缺少企业 ID" };
  const user = await requireUser(`/organizations/${slug}/settings`);
  try {
    await requireActiveUser(user);
  } catch (err) {
    if (err instanceof SuspendedError) return { ok: false, message: err.message };
    throw err;
  }
  const raw = {
    name: String(formData.get("name") || "").trim(),
    description: String(formData.get("description") || "").trim() || undefined,
    logo: String(formData.get("logo") || "").trim() || undefined,
    website: String(formData.get("website") || "").trim() || undefined,
    industry: String(formData.get("industry") || "").trim() || null,
    size: String(formData.get("size") || "").trim() || null,
    contactEmail: String(formData.get("contactEmail") || "").trim() || undefined,
  } as Record<string, unknown>;
  const parsed = UpdateOrganizationSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "请检查表单",
      fieldErrors: parsed.error.flatten().fieldErrors as OrgActionState["fieldErrors"],
    };
  }
  try {
    await updateOrganization({
      organizationId: id,
      actorId: user.id,
      input: parsed.data,
    });
  } catch (err) {
    return { ok: false, message: appErrorMessage(err) };
  }
  revalidatePath("/me/organizations");
  revalidatePath("/organizations");
  revalidatePath(`/organizations/${slug}`);
  revalidatePath(`/organizations/${slug}/settings`);
  return { ok: true, message: "已保存" };
}

export async function deleteOrganizationAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") || "");
  if (!id) return;
  const user = await requireUser("/me/organizations");
  try {
    await deleteOrganization({ organizationId: id, actorId: user.id });
  } catch {
    // 失败时静默；上游列表会 revalidate
  }
  revalidatePath("/me/organizations");
  revalidatePath("/organizations");
  redirect("/me/organizations");
}

export async function leaveOrganizationAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") || "");
  if (!id) return;
  const user = await requireUser("/me/organizations");
  try {
    await leaveOrganization({ organizationId: id, userId: user.id });
  } catch {
    // 失败静默
  }
  revalidatePath("/me/organizations");
  redirect("/me/organizations");
}

export async function inviteMemberAction(
  _prev: OrgActionState,
  formData: FormData,
): Promise<OrgActionState> {
  const id = String(formData.get("id") || "");
  const slug = String(formData.get("slug") || "");
  if (!id) return { ok: false, message: "缺少企业 ID" };
  const user = await requireUser(`/organizations/${slug}/members`);
  try {
    await requireActiveUser(user);
  } catch (err) {
    if (err instanceof SuspendedError) return { ok: false, message: err.message };
    throw err;
  }
  const inviteeUsername = String(formData.get("inviteeUsername") || "").trim();
  const role = String(formData.get("role") || "MEMBER") as InviteAssignableRole;
  const message = String(formData.get("message") || "").trim() || undefined;
  try {
    await inviteMember({
      organizationId: id,
      actorId: user.id,
      input: { inviteeUsername, role, message: message ?? null },
    });
  } catch (err) {
    return { ok: false, message: appErrorMessage(err) };
  }
  revalidatePath(`/organizations/${slug}/members`);
  return { ok: true, message: "邀请已发出" };
}

export async function cancelInviteAction(formData: FormData): Promise<void> {
  const inviteId = String(formData.get("inviteId") || "");
  const slug = String(formData.get("slug") || "");
  if (!inviteId) return;
  const user = await requireUser(`/organizations/${slug}/members`);
  try {
    await cancelInvite({ inviteId, actorId: user.id });
  } catch {
    // 失败时静默
  }
  revalidatePath(`/organizations/${slug}/members`);
}

export async function respondInviteAction(formData: FormData): Promise<void> {
  const inviteId = String(formData.get("inviteId") || "");
  const action = String(formData.get("action") || "");
  if (!inviteId || (action !== "accept" && action !== "reject")) return;
  const user = await requireUser("/me/organizations/invites");
  try {
    await respondToInvite({
      inviteId,
      userId: user.id,
      accept: action === "accept",
    });
  } catch {
    // 失败时静默
  }
  revalidatePath("/me/organizations/invites");
  revalidatePath("/me/organizations");
}

export async function updateMemberRoleAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") || "");
  const slug = String(formData.get("slug") || "");
  const userId = String(formData.get("userId") || "");
  const role = String(formData.get("role") || "") as InviteAssignableRole;
  if (!id || !userId) return;
  const actor = await requireUser(`/organizations/${slug}/members`);
  try {
    await updateMemberRole({
      organizationId: id,
      actorId: actor.id,
      targetUserId: userId,
      role,
    });
  } catch {
    // 静默
  }
  revalidatePath(`/organizations/${slug}/members`);
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") || "");
  const slug = String(formData.get("slug") || "");
  const userId = String(formData.get("userId") || "");
  if (!id || !userId) return;
  const actor = await requireUser(`/organizations/${slug}/members`);
  try {
    await removeMember({
      organizationId: id,
      actorId: actor.id,
      targetUserId: userId,
    });
  } catch {
    // 静默
  }
  revalidatePath(`/organizations/${slug}/members`);
}

// Stage 11.2：企业认证 server actions ───────────────────────────────

export async function submitVerificationAction(
  _prev: OrgActionState,
  formData: FormData,
): Promise<OrgActionState> {
  const id = String(formData.get("id") || "");
  const slug = String(formData.get("slug") || "");
  if (!id) return { ok: false, message: "缺少企业 ID" };
  const user = await requireUser(`/organizations/${slug}/settings`);
  const raw = {
    name: String(formData.get("name") || "").trim(),
    regNo: String(formData.get("regNo") || "").trim(),
    rep: String(formData.get("rep") || "").trim(),
    licenseUrl: String(formData.get("licenseUrl") || "").trim(),
    contact: String(formData.get("contact") || "").trim(),
    note: String(formData.get("note") || "").trim() || undefined,
  };
  const parsed = SubmitVerificationSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "请检查表单",
      fieldErrors: parsed.error.flatten().fieldErrors as OrgActionState["fieldErrors"],
    };
  }
  try {
    await submitOrgVerification({
      organizationId: id,
      actorId: user.id,
      input: parsed.data,
    });
  } catch (err) {
    return { ok: false, message: appErrorMessage(err) };
  }
  revalidatePath(`/organizations/${slug}`);
  revalidatePath(`/organizations/${slug}/settings`);
  revalidatePath(`/admin/organizations/verifications`);
  return { ok: true, message: "已提交，等待审核" };
}

export async function cancelVerificationAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") || "");
  const slug = String(formData.get("slug") || "");
  if (!id) return;
  const user = await requireUser(`/organizations/${slug}/settings`);
  try {
    await cancelOrgVerification({ organizationId: id, actorId: user.id });
  } catch {
    // 静默
  }
  revalidatePath(`/organizations/${slug}/settings`);
  revalidatePath(`/admin/organizations/verifications`);
}

export async function reviewVerificationAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") || "");
  const decision = String(formData.get("decision") || "");
  const note = String(formData.get("note") || "").trim();
  if (!id || (decision !== "APPROVE" && decision !== "REJECT")) return;
  // 这里只挂在管理员页里，正路径校验由 API + requireAdmin 完成；form action 多用一道兜底。
  const user = await requireUser(`/admin/organizations/verifications`);
  if (user.role !== "ADMIN") return;
  try {
    await reviewOrgVerification({
      organizationId: id,
      adminId: user.id,
      input: { decision: decision as "APPROVE" | "REJECT", note },
    });
  } catch {
    // 静默；列表 revalidate 后状态会同步。
  }
  revalidatePath(`/admin/organizations/verifications`);
  revalidatePath(`/organizations`);
}
