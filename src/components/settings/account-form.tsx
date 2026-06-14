"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Initial = {
  name: string;
  avatar: string | null;
  bio: string | null;
  industryRole: string | null;
  expertise: string[];
  favoriteTools: string[];
  portfolioLinks: string[];
  contact: string | null;
};

// Stage 9：通用账户表单。命中 PUT /api/me/account；与 ProfileEditDialog 字段一致。

export function AccountForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState(initial.name);
  const [avatar, setAvatar] = useState(initial.avatar ?? "");
  const [bio, setBio] = useState(initial.bio ?? "");
  const [industryRole, setIndustryRole] = useState(initial.industryRole ?? "");
  const [expertise, setExpertise] = useState(initial.expertise.join(", "));
  const [favoriteTools, setFavoriteTools] = useState(
    initial.favoriteTools.join(", "),
  );
  const [portfolioLinks, setPortfolioLinks] = useState(
    initial.portfolioLinks.join("\n"),
  );
  const [contact, setContact] = useState(initial.contact ?? "");
  const [message, setMessage] = useState<{
    tone: "ok" | "err";
    text: string;
  } | null>(null);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const splitList = (raw: string) =>
      raw
        .split(/[,，\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
    const payload = {
      name,
      avatar: avatar.trim() || null,
      bio: bio.trim() || null,
      industryRole: industryRole.trim() || null,
      expertise: splitList(expertise),
      favoriteTools: splitList(favoriteTools),
      portfolioLinks: splitList(portfolioLinks),
      contact: contact.trim() || null,
    };
    start(async () => {
      const res = await fetch("/api/me/account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setMessage({ tone: "ok", text: data.message ?? "已保存" });
        router.refresh();
      } else {
        setMessage({
          tone: "err",
          text: data?.error?.message ?? "保存失败，请稍后重试",
        });
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="昵称" required>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            className={inputClass}
          />
        </Field>
        <Field label="头像 URL">
          <input
            value={avatar}
            onChange={(e) => setAvatar(e.target.value)}
            maxLength={500}
            className={inputClass}
            placeholder="https://..."
          />
        </Field>
        <Field label="行业角色">
          <input
            value={industryRole}
            onChange={(e) => setIndustryRole(e.target.value)}
            maxLength={120}
            className={inputClass}
            placeholder="例如 导演 / 编剧"
          />
        </Field>
        <Field label="联系方式">
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            maxLength={120}
            className={inputClass}
            placeholder="微信 / Discord / 邮箱"
          />
        </Field>
        <Field label="简介" className="sm:col-span-2">
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={2}
            maxLength={280}
            className={textareaClass}
          />
        </Field>
        <Field label="擅长领域（逗号分隔）" className="sm:col-span-2">
          <input
            value={expertise}
            onChange={(e) => setExpertise(e.target.value)}
            className={inputClass}
            placeholder="提示工程, 视频后期"
          />
        </Field>
        <Field label="常用 AI 工具（逗号分隔）" className="sm:col-span-2">
          <input
            value={favoriteTools}
            onChange={(e) => setFavoriteTools(e.target.value)}
            className={inputClass}
            placeholder="Seedance 2.0, Midjourney"
          />
        </Field>
        <Field label="作品链接（每行一个 URL，最多 10）" className="sm:col-span-2">
          <textarea
            value={portfolioLinks}
            onChange={(e) => setPortfolioLinks(e.target.value)}
            rows={3}
            className={textareaClass}
            placeholder="https://..."
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
          disabled={pending}
          className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
        >
          {pending ? "保存中…" : "保存"}
        </button>
      </div>
    </form>
  );
}

const inputClass =
  "h-8 w-full rounded-md border border-border bg-background/40 px-2 text-sm outline-none focus:border-primary/50";
const textareaClass =
  "w-full rounded-md border border-border bg-background/40 px-2 py-1.5 text-sm outline-none focus:border-primary/50";

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
        {label}
        {required && <span className="text-rose-400">*</span>}
      </label>
      {children}
    </div>
  );
}
