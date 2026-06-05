"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// Stage 9：改密 / 改邮箱。两块独立 form；改密后服务端 bump tokensValidAfter +
// 重新签发 cookie，所以本页面 client 状态不需要重新登录。

export function PasswordEmailForm({ currentEmail }: { currentEmail: string }) {
  return (
    <div className="space-y-5">
      <ChangePasswordForm />
      <ChangeEmailForm currentEmail={currentEmail} />
    </div>
  );
}

function ChangePasswordForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<{
    tone: "ok" | "err";
    text: string;
  } | null>(null);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (next !== confirm) {
      setMessage({ tone: "err", text: "两次输入的新密码不一致" });
      return;
    }
    start(async () => {
      const res = await fetch("/api/me/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setMessage({ tone: "ok", text: data.message ?? "已修改" });
        setCurrent("");
        setNext("");
        setConfirm("");
        router.refresh();
      } else {
        setMessage({
          tone: "err",
          text: data?.error?.message ?? "修改失败，请检查当前密码",
        });
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <h3 className="text-xs font-medium text-foreground/90">修改密码</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="当前密码">
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className={inputClass}
            autoComplete="current-password"
          />
        </Field>
        <Field label="新密码（≥8 位，字母 + 数字）">
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className={inputClass}
            autoComplete="new-password"
          />
        </Field>
        <Field label="再输一遍">
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputClass}
            autoComplete="new-password"
          />
        </Field>
      </div>
      <div className="flex items-center justify-end gap-3">
        {message && (
          <span
            className={
              message.tone === "ok"
                ? "text-xs text-emerald-300"
                : "text-xs text-rose-400"
            }
          >
            {message.text}
          </span>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
        >
          {pending ? "提交中…" : "修改密码"}
        </button>
      </div>
    </form>
  );
}

function ChangeEmailForm({ currentEmail }: { currentEmail: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [email, setEmail] = useState(currentEmail);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<{
    tone: "ok" | "err";
    text: string;
  } | null>(null);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    start(async () => {
      const res = await fetch("/api/me/email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newEmail: email, currentPassword: password }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setMessage({ tone: "ok", text: data.message ?? "已修改" });
        setPassword("");
        router.refresh();
      } else {
        setMessage({
          tone: "err",
          text: data?.error?.message ?? "修改失败",
        });
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3 border-t border-border/40 pt-4">
      <h3 className="text-xs font-medium text-foreground/90">修改邮箱</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="新邮箱">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            autoComplete="email"
          />
        </Field>
        <Field label="当前密码">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            autoComplete="current-password"
          />
        </Field>
      </div>
      <div className="flex items-center justify-end gap-3">
        {message && (
          <span
            className={
              message.tone === "ok"
                ? "text-xs text-emerald-300"
                : "text-xs text-rose-400"
            }
          >
            {message.text}
          </span>
        )}
        <button
          type="submit"
          disabled={pending || email === currentEmail}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
        >
          {pending ? "提交中…" : "修改邮箱"}
        </button>
      </div>
    </form>
  );
}

const inputClass =
  "h-8 w-full rounded-md border border-border/60 bg-background/40 px-2 text-sm outline-none focus:border-primary/50";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
