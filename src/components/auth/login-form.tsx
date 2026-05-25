"use client";

import { useActionState } from "react";

import { FormError, FormField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/loading";
import { loginAction, type AuthFormState } from "@/lib/auth/actions";

const initial: AuthFormState = {};

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [state, action, pending] = useActionState(loginAction, initial);

  return (
    <form action={action} className="space-y-4">
      {redirectTo && (
        <input type="hidden" name="redirectTo" value={redirectTo} />
      )}

      <FormField
        label="邮箱或用户名"
        htmlFor="identifier"
        required
        error={state.fieldErrors?.identifier}
      >
        <Input
          id="identifier"
          name="identifier"
          autoComplete="username"
          placeholder="you@example.com 或 username"
          aria-invalid={(state.fieldErrors?.identifier?.length ?? 0) > 0 || undefined}
          required
        />
      </FormField>

      <FormField
        label="密码"
        htmlFor="password"
        required
        error={state.fieldErrors?.password}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="输入你的密码"
          aria-invalid={(state.fieldErrors?.password?.length ?? 0) > 0 || undefined}
          required
        />
      </FormField>

      {state.message && !state.ok && <FormError message={state.message} />}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending && <Spinner className="size-4 text-primary-foreground" />}
        {pending ? "登录中…" : "登录"}
      </button>
    </form>
  );
}
