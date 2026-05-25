import { z } from "zod";

export const RegisterApiSchema = z.object({
  email: z.email("请输入有效邮箱"),
  password: z
    .string()
    .min(8, "密码至少 8 个字符")
    .max(128, "密码不能超过 128 个字符")
    .regex(/[a-zA-Z]/, "密码需包含字母")
    .regex(/[0-9]/, "密码需包含数字"),
  name: z
    .string()
    .min(1, "请输入昵称")
    .max(40, "昵称最多 40 个字符"),
  role: z.enum(["USER", "MOD", "ADMIN"]).optional(),
  bio: z.string().max(280, "简介最多 280 个字符").optional(),
});

export type RegisterApiInput = z.infer<typeof RegisterApiSchema>;

export const LoginApiSchema = z.object({
  email: z.email("请输入有效邮箱"),
  password: z.string().min(1, "请输入密码"),
});

export type LoginApiInput = z.infer<typeof LoginApiSchema>;
