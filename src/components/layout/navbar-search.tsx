"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

export function NavbarSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  const initialQ = searchParams.get("q") ?? "";

  // 全局 "/" 快捷键 focus 搜索框；在 input/textarea/contentEditable 内时跳过
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "/") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const tag = t.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        t.isContentEditable
      ) {
        return;
      }
      e.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const q = (
      (form.elements.namedItem("q") as HTMLInputElement | null)?.value ?? ""
    ).trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className="flex w-full max-w-md items-center"
    >
      <label className="group/search relative flex h-8 w-full items-center rounded-lg border border-border/60 bg-card/40 px-2.5 text-sm transition-colors focus-within:border-primary/50 focus-within:bg-card/70">
        <Search className="size-3.5 text-muted-foreground" />
        <input
          // 当 URL ?q 变化时，key 会让输入框重新挂载，恢复为最新 URL 值
          key={initialQ}
          ref={inputRef}
          name="q"
          type="search"
          defaultValue={initialQ}
          placeholder="搜索作品、创作者、频道、工具..."
          aria-label="搜索"
          className="ml-2 h-full flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <kbd className="hidden rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline-block">
          /
        </kbd>
      </label>
    </form>
  );
}
