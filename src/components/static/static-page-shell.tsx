import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * 静态信息页通用外壳：返回首页面包屑 + 标题 + 副标题 + 内容。
 * 用于 /about /contact /legal/* /community/rules 等。
 */
export function StaticPageShell({
  eyebrow,
  title,
  description,
  updated,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  /** 「最后更新于 …」展示日期。传日期字符串即可。 */
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="relative overflow-hidden border-b border-border px-6 py-10 sm:px-8 sm:py-12">
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="relative space-y-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1 rounded-full border border-border bg-card/50 px-2.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
          >
            <ArrowLeft className="size-3" />
            返回首页
          </Link>
          {eyebrow && (
            <div className="text-[11px] font-medium uppercase tracking-widest text-primary/80">
              {eyebrow}
            </div>
          )}
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
            {title}
          </h1>
          {description && (
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {description}
            </p>
          )}
          {updated && (
            <p className="text-[11px] text-muted-foreground/60">
              最后更新：{updated}
            </p>
          )}
        </div>
      </header>

      <article className="static-prose mx-auto w-full max-w-3xl px-4 py-8 text-sm sm:px-8 sm:py-12 sm:text-base">
        {children}
      </article>
    </div>
  );
}

/** 段落标题 (h2) */
export function PageH2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-10 border-b border-border pb-2 text-xl font-semibold tracking-tight first:mt-0">
      {children}
    </h2>
  );
}

/** 段落小标题 (h3) */
export function PageH3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-6 text-base font-semibold tracking-tight">{children}</h3>
  );
}
