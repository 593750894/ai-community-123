"use client";

import { useActionState } from "react";

import { FormError, FormField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/loading";
import { registerAction, type AuthFormState } from "@/lib/auth/actions";

const initial: AuthFormState = {};

type FieldConfig = {
  label: string;
  name: "username" | "name" | "email" | "password" | "confirmPassword";
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  hint?: string;
};

const FIELDS: FieldConfig[] = [
  {
    label: "用户名",
    name: "username",
    autoComplete: "username",
    placeholder: "3-24 位字母 / 数字 / _ -",
    hint: "用于 @ 与个人主页 URL，注册后无法随意修改",
  },
  {
    label: "昵称",
    name: "name",
    autoComplete: "nickname",
    placeholder: "社区里展示的名字",
  },
  {
    label: "邮箱",
    name: "email",
    type: "email",
    autoComplete: "email",
    placeholder: "you@example.com",
  },
  {
    label: "密码",
    name: "password",
    type: "password",
    autoComplete: "new-password",
    placeholder: "至少 8 位，含字母与数字",
  },
  {
    label: "确认密码",
    name: "confirmPassword",
    type: "password",
    autoComplete: "new-password",
    placeholder: "再输入一次",
  },
];

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, initial);

  return (
    <form action={action} className="space-y-4">
      {FIELDS.map((f) => {
        const errs = state.fieldErrors?.[f.name];
        return (
          <FormField
            key={f.name}
            label={f.label}
            htmlFor={f.name}
            required
            hint={f.hint}
            error={errs}
          >
            <Input
              id={f.name}
              name={f.name}
              type={f.type ?? "text"}
              autoComplete={f.autoComplete}
              placeholder={f.placeholder}
              aria-invalid={(errs?.length ?? 0) > 0 || undefined}
              required
            />
          </FormField>
        );
      })}

      {state.message && !state.ok && <FormError message={state.message} />}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending && <Spinner className="size-4 text-primary-foreground" />}
        {pending ? "注册中…" : "创建账号"}
      </button>

      <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
        注册即表示你同意社区行为准则。密码使用 bcrypt 加盐哈希后存储，平台不会明文保存。
      </p>
    </form>
  );
}
