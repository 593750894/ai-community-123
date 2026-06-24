import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChip } from "@/components/ui/filter-chip";
import { CreateBlockedWordForm } from "@/components/admin/create-blocked-word-form";
import { DeleteBlockedWordButton } from "@/components/admin/delete-blocked-word-button";
import { requireAdmin } from "@/lib/auth/guard";
import {
  BLOCKED_WORD_SCOPES,
  BLOCKED_WORD_SCOPE_LABEL,
  BLOCKED_WORD_SEVERITIES,
  BLOCKED_WORD_SEVERITY_LABEL,
  listBlockedWords,
} from "@/lib/content/blocked-words";
import type {
  BlockedWordScope,
  BlockedWordSeverity,
} from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    scope?: string;
    severity?: string;
    page?: string;
  }>;
}

function parseScope(raw?: string): BlockedWordScope | undefined {
  if (!raw || raw === "ALL_FILTER") return undefined;
  return (BLOCKED_WORD_SCOPES as readonly string[]).includes(raw)
    ? (raw as BlockedWordScope)
    : undefined;
}

function parseSeverity(raw?: string): BlockedWordSeverity | undefined {
  if (!raw) return undefined;
  return (BLOCKED_WORD_SEVERITIES as readonly string[]).includes(raw)
    ? (raw as BlockedWordSeverity)
    : undefined;
}

export default async function AdminBlockedWordsPage({ searchParams }: PageProps) {
  await requireAdmin("/admin/blocked-words");
  const params = await searchParams;
  const q = (params.q ?? "").trim() || undefined;
  const scope = parseScope(params.scope);
  const severity = parseSeverity(params.severity);
  const page = Math.max(1, Number(params.page) || 1);

  const { items, total, pageSize } = await listBlockedWords({
    q,
    scope,
    severity,
    page,
    pageSize: 30,
  });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const buildHref = (
    overrides: Partial<{
      q: string;
      scope: string;
      severity: string;
      page: number;
    }>,
  ) => {
    const sp = new URLSearchParams();
    if (q && overrides.q === undefined) sp.set("q", q);
    if (overrides.q) sp.set("q", overrides.q);
    if (params.scope && overrides.scope === undefined) sp.set("scope", params.scope);
    if (overrides.scope) sp.set("scope", overrides.scope);
    if (params.severity && overrides.severity === undefined)
      sp.set("severity", params.severity);
    if (overrides.severity) sp.set("severity", overrides.severity);
    if (overrides.page && overrides.page > 1) sp.set("page", String(overrides.page));
    const qs = sp.toString();
    return qs ? `/admin/blocked-words?${qs}` : "/admin/blocked-words";
  };

  return (
    <>
      <PageHeader
        eyebrow="发布期治理"
        title="违禁关键词"
        description="命中关键词的内容将在创建时被拒绝（BLOCK）或仅记录审计（WARN）。修改后 60 秒内全实例生效。"
      />

      <div className="space-y-5 px-4 py-5 sm:px-8 sm:py-6">
        <section className="rounded-2xl border border-border bg-card/40 p-4">
          <h2 className="text-sm font-medium">新增关键词</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            关键词不区分大小写，使用「全文 substring」匹配；选 ALL 适用所有内容类型。
          </p>
          <div className="mt-3">
            <CreateBlockedWordForm />
          </div>
        </section>

        <form
          method="get"
          action="/admin/blocked-words"
          className="flex flex-wrap items-center gap-2"
        >
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="按关键词模糊搜索…"
            className="h-9 w-72 rounded-md border border-border bg-background/40 px-2 text-sm outline-none focus:border-primary/50"
          />
          {params.scope && <input type="hidden" name="scope" value={params.scope} />}
          {params.severity && (
            <input type="hidden" name="severity" value={params.severity} />
          )}
          <button className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted/60">
            搜索
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              严重度
            </span>
            <FilterChip
              href={buildHref({ severity: "", page: 1 })}
              active={!severity}
              label="全部"
            />
            {BLOCKED_WORD_SEVERITIES.map((s) => (
              <FilterChip
                key={s}
                href={buildHref({ severity: s, page: 1 })}
                active={severity === s}
                label={BLOCKED_WORD_SEVERITY_LABEL[s]}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              适用范围
            </span>
            <FilterChip
              href={buildHref({ scope: "", page: 1 })}
              active={!scope}
              label="全部"
            />
            {BLOCKED_WORD_SCOPES.map((s) => (
              <FilterChip
                key={s}
                href={buildHref({ scope: s, page: 1 })}
                active={scope === s}
                label={BLOCKED_WORD_SCOPE_LABEL[s]}
              />
            ))}
          </div>
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon={ShieldAlert}
            title="当前筛选下没有违禁词"
            description="切换筛选或在上方新增第一个关键词。"
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">关键词</th>
                  <th className="px-3 py-2 text-left">严重度</th>
                  <th className="px-3 py-2 text-left">适用范围</th>
                  <th className="px-3 py-2 text-left">命中次数</th>
                  <th className="px-3 py-2 text-left">备注</th>
                  <th className="px-3 py-2 text-left">创建人 / 时间</th>
                  <th className="px-3 py-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-border align-top hover:bg-muted/20"
                  >
                    <td className="break-all px-3 py-2 font-mono">{row.pattern}</td>
                    <td className="px-3 py-2">
                      <Badge
                        variant={
                          row.severity === "BLOCK" ? "destructive" : "warning"
                        }
                      >
                        {row.severity}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {BLOCKED_WORD_SCOPE_LABEL[row.scope]}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{row.hitCount}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      <p className="line-clamp-2 max-w-xs">{row.note ?? "—"}</p>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      <p className="font-medium text-foreground">
                        {row.createdBy.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground/70 tabular-nums">
                        {new Date(row.createdAt).toISOString().slice(0, 10)}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <DeleteBlockedWordButton wordId={row.id} pattern={row.pattern} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <nav className="flex items-center justify-center gap-3 text-xs">
            <PagerLink
              href={buildHref({ page: Math.max(1, page - 1) })}
              disabled={page <= 1}
              label="← 上一页"
            />
            <span className="text-muted-foreground">
              {page} / {totalPages}
            </span>
            <PagerLink
              href={buildHref({ page: Math.min(totalPages, page + 1) })}
              disabled={page >= totalPages}
              label="下一页 →"
            />
          </nav>
        )}

        <p className="rounded-md border border-border bg-card/30 px-3 py-2 text-[11px] text-muted-foreground">
          命中事件会出现在 /admin/audit-logs 的 BLOCKED_WORD_BLOCK_HIT / WARN_HIT 行。
          删除关键词不会清空历史命中审计。
        </p>
      </div>
    </>
  );
}

function PagerLink({
  href,
  disabled,
  label,
}: {
  href: string;
  disabled: boolean;
  label: string;
}) {
  if (disabled) {
    return (
      <span className="cursor-default px-3 py-1 text-muted-foreground/50">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="rounded-md border border-border px-3 py-1 text-muted-foreground hover:text-foreground"
    >
      {label}
    </Link>
  );
}
