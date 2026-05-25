import { z } from "zod";

export const RegisterSchema = z
  .object({
    username: z
      .string()
      .min(3, "用户名至少 3 个字符")
      .max(24, "用户名最多 24 个字符")
      .regex(
        /^[a-zA-Z0-9_-]+$/,
        "用户名只能包含字母、数字、下划线和连字符",
      ),
    email: z.email("请输入有效邮箱"),
    name: z
      .string()
      .min(1, "请输入昵称")
      .max(40, "昵称最多 40 个字符"),
    password: z
      .string()
      .min(8, "密码至少 8 个字符")
      .max(128, "密码不能超过 128 个字符")
      .regex(/[a-zA-Z]/, "密码需包含字母")
      .regex(/[0-9]/, "密码需包含数字"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "两次输入的密码不一致",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  identifier: z.string().min(1, "请输入邮箱或用户名"),
  password: z.string().min(1, "请输入密码"),
});

export type LoginInput = z.infer<typeof LoginSchema>;

const optionalTrimmed = z
  .string()
  .trim()
  .max(120, "最多 120 个字符")
  .optional()
  .or(z.literal(""))
  .transform((v) => (v && v.length > 0 ? v : null));

export const UpdateProfileSchema = z.object({
  name: z.string().trim().min(1, "请输入昵称").max(40, "昵称最多 40 个字符"),
  avatar: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v && v.length > 0 ? v : null)),
  bio: z
    .string()
    .trim()
    .max(280, "简介最多 280 个字符")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v && v.length > 0 ? v : null)),
  industryRole: optionalTrimmed,
  expertise: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  favoriteTools: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  portfolioLinks: z
    .array(z.string().trim().url("作品链接需要是有效 URL").max(500))
    .max(10)
    .default([]),
  contact: optionalTrimmed,
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
