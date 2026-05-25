"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { prisma, Prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  createSessionCookie,
  clearSessionCookie,
  getSession,
} from "@/lib/auth/session";
import {
  LoginSchema,
  RegisterSchema,
  UpdateProfileSchema,
} from "@/lib/auth/schemas";

export type AuthFormState = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

function flattenZodError(error: import("zod").ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!result[key]) result[key] = [];
    result[key].push(issue.message);
  }
  return result;
}

function readArrayField(formData: FormData, key: string): string[] {
  const raw = formData.get(key);
  if (typeof raw !== "string" || raw.trim() === "") return [];
  return raw
    .split(/[\n,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function registerAction(
  _state: AuthFormState | undefined,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = RegisterSchema.safeParse({
    username: formData.get("username"),
    email: formData.get("email"),
    name: formData.get("name"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { ok: false, fieldErrors: flattenZodError(parsed.error) };
  }

  const { username, email, name, password } = parsed.data;
  const passwordHash = await hashPassword(password);

  let userId: string;
  try {
    const created = await prisma.user.create({
      data: {
        username,
        email,
        name,
        passwordHash,
        avatar: `https://api.dicebear.com/9.x/glass/svg?seed=${encodeURIComponent(username)}`,
      },
      select: { id: true, username: true },
    });
    userId = created.id;
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const target = (err.meta?.target as string[] | undefined) ?? [];
      const field = target.includes("email") ? "email" : "username";
      return {
        ok: false,
        fieldErrors: {
          [field]: [
            field === "email" ? "该邮箱已被注册" : "该用户名已被占用",
          ],
        },
      };
    }
    return { ok: false, message: "注册失败，请稍后重试" };
  }

  await createSessionCookie({ userId, username });
  redirect(`/profile/${userId}`);
}

export async function loginAction(
  _state: AuthFormState | undefined,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = LoginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { ok: false, fieldErrors: flattenZodError(parsed.error) };
  }

  const { identifier, password } = parsed.data;
  const user = await prisma.user.findFirst({
    where: identifier.includes("@")
      ? { email: identifier }
      : { username: identifier },
    select: { id: true, username: true, passwordHash: true },
  });

  if (!user) {
    return { ok: false, message: "账号或密码错误" };
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return { ok: false, message: "账号或密码错误" };
  }

  await createSessionCookie({ userId: user.id, username: user.username });

  const redirectTo = formData.get("redirectTo");
  const target =
    typeof redirectTo === "string" &&
    redirectTo.startsWith("/") &&
    !redirectTo.startsWith("//")
      ? redirectTo
      : `/profile/${user.id}`;
  redirect(target);
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/");
}

export async function updateProfileAction(
  _state: AuthFormState | undefined,
  formData: FormData,
): Promise<AuthFormState> {
  const session = await getSession();
  if (!session) {
    return { ok: false, message: "请先登录" };
  }

  const parsed = UpdateProfileSchema.safeParse({
    name: formData.get("name"),
    avatar: formData.get("avatar"),
    bio: formData.get("bio"),
    industryRole: formData.get("industryRole"),
    expertise: readArrayField(formData, "expertise"),
    favoriteTools: readArrayField(formData, "favoriteTools"),
    portfolioLinks: readArrayField(formData, "portfolioLinks"),
    contact: formData.get("contact"),
  });

  if (!parsed.success) {
    return { ok: false, fieldErrors: flattenZodError(parsed.error) };
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: parsed.data,
  });

  revalidatePath(`/profile/${session.userId}`);
  return { ok: true, message: "已保存" };
}
