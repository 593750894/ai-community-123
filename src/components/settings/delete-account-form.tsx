"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const CONFIRM_PHRASE = "注销";

export function DeleteAccountForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [password, setPassword] = useState("");
  const [phrase, setPhrase] = useState("");
  const [message, setMessage] = useState<{
    tone: "ok" | "err";
    text: string;
  } | null>(null);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (phrase !== CONFIRM_PHRASE) {
      setMessage({ tone: "err", text: `请在确认框中输入 ${CONFIRM_PHRASE}` });
      return;
    }
    start(async () => {
      const res = await fetch("/api/me", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: password }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setMessage({ tone: "ok", text: data.message ?? "已注销" });
        router.replace("/");
        router.refresh();
      } else {
        setMessage({
          tone: "err",
          text: data?.error?.message ?? "注销失败，请检查当前密码",
        });
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="当前密码">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            autoComplete="current-password"
          />
        </Field>
        <Field label={`输入 ${CONFIRM_PHRASE} 以确认`}>
          <input
            type="text"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            className={inputClass}
            autoComplete="off"
          />
        </Field>
      </div>
      <div className="flex items-center justify-end gap-3">
        {message && (
          <span
            className={
              message.tone === "ok"
                ? "text-xs text-tag-emerald-fg"
                : "text-xs text-rose-400"
            }
          >
            {message.text}
          </span>
        )}
        <button
          type="submit"
          disabled={pending || phrase !== CONFIRM_PHRASE}
          className="rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 disabled:opacity-50"
        >
          {pending ? "处理中…" : "注销账户"}
        </button>
      </div>
    </form>
  );
}

const inputClass =
  "h-8 w-full rounded-md border border-border bg-background/40 px-2 text-sm outline-none focus:border-primary/50";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-destructive/80">{label}</label>
      {children}
    </div>
  );
}
