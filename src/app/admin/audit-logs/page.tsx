import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import {
  AUDIT_ACTIONS,
  AUDIT_ACTION_LABEL,
  AUDIT_TARGET_LABEL,
  AUDIT_TARGET_TYPES,
} from "@/lib/admin/audit";
import { listAuditLogs } from "@/lib/admin/audit-queries";
import { requireAdmin } from "@/lib/auth/guard";
import { cn, formatRelativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

function parseDate(
  raw: string | undefined,
  endOfDay = false,
): Date | undefined {
  if (!raw) return undefined;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return undefined;
  if (endOfDay) {
    // 把 yyyy-mm-dd 当成 [00:00, 24:00)：用 23:59:59.999 当 inclusive 上界
    d.setHours(23, 59, 59, 999);
  }
  return d;
}

function parseAction(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return (AUDIT_ACTIONS as readonly string[]).includes(raw) ? raw : undefined;
}

function parseTargetType(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return (AUDIT_TARGET_TYPES as readonly string[]).includes(raw)
    ? raw
    : undefined;
}

function buildTargetLink(targetType: string | null, targetId: string | null) {
  if (!targetType || !targetId) return null;
  switch (targetType) {
    case "Post":
      return `/post/${targetId}`;
    case "Work":
      return `/showcase/${targetId}`;
    case "Collaboration":
      return `/collaboration/${targetId}`;
    case "User":
      return `/profile/${targetId}`;
    case "Comment": {
      // metadata 里通常带 postId，但 list 行视图先不展开。
      return null;
    }
    default:
      return null;
  }
}

export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    actor?: string;
    action?: string;
    targetType?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  await requireAdmin("/admin/audit-logs");
  const sp = await searchParams;
  const actor = (sp.actor ?? "").trim() || undefined;
  const action = parseAction(sp.action);
  const targetType = parseTargetType(sp.targetType);
  const from = parseDate(sp.from);
  const to = parseDate(sp.to, true);
  const page = Math.max(1, Number(sp.page) || 1);

  const { items, total } = await listAuditLogs({
    adminUsername: actor,
    action,
    targetType,
    from,
    to,
    page,
    pageSize: PAGE_SIZE,
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        eyebrow="管理后台"
        title="操作审计"
        description={`共 ${total} 条记录。按管理员 / 动作 / 目标类型 / 时间筛选。`}
      />

      <div className="space-y-4 px-6 py-6 sm:px-8">
        <form
          method="GET"
          className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card/40 p-3"
        >
          <Labeled label="操作人（用户名 / 昵称）">
            <input
              type="text"
              name="actor"
              defaultValue={actor ?? ""}
              placeholder="@alice 或 张三"
              className="block h-9 w-44 rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-primary/60"
            />
          </Labeled>
          <Labeled label="动作">
            <select
              name="action"
              defaultValue={action ?? ""}
              className="block h-9 w-44 rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-primary/60"
            >
              <option value="">全部</option>
              {AUDIT_ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {AUDIT_ACTION_LABEL[a] ?? a}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label="目标类型">
            <select
              name="targetType"
              defaultValue={targetType ?? ""}
              className="block h-9 w-32 rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-primary/60"
            >
              <option value="">全部</option>
              {AUDIT_TARGET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {AUDIT_TARGET_LABEL[t] ?? t}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label="起始日期">
            <input
              type="date"
              name="from"
              defaultValue={sp.from ?? ""}
              className="block h-9 w-36 rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-primary/60"
            />
          </Labeled>
          <Labeled label="结束日期">
            <input
              type="date"
              name="to"
              defaultValue={sp.to ?? ""}
              className="block h-9 w-36 rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-primary/60"
            />
          </Labeled>
          <button
            type="submit"
            className="inline-flex h-9 items-center gap-1 rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            筛选
          </button>
          {(actor || action || targetType || from || to) && (
            <Link
              href="/admin/audit-logs"
              className="inline-flex h-9 items-center gap-1 rounded-full border border-border px-3 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            >
              清除
            </Link>
          )}
        </form>

        <div className="overflow-hidden rounded-xl border border-border bg-card/40">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">时间</th>
                <th className="px-4 py-2.5 text-left font-medium">操作人</th>
                <th className="px-4 py-2.5 text-left font-medium">动作</th>
                <th className="px-4 py-2.5 text-left font-medium">目标</th>
                <th className="px-4 py-2.5 text-left font-medium">元数据</th>
                <th className="px-4 py-2.5 text-left font-medium">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((log) => {
                const targetLink = buildTargetLink(log.targetType, log.targetId);
                return (
                  <tr key={log.id} className="align-top hover:bg-muted/20">
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      <div>{formatRelativeTime(log.createdAt)}</div>
                      <div className="text-[10px] text-muted-foreground/70">
                        {log.createdAt.toISOString().slice(0, 19).replace("T", " ")}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {log.admin ? (
                        <>
                          <Link
                            href={`/profile/${log.admin.id}`}
                            className="font-medium text-foreground/90 hover:text-primary"
                          >
                            {log.admin.name}
                          </Link>
                          <div className="text-[10px] text-muted-foreground">
                            @{log.admin.username}
                          </div>
                        </>
                      ) : (
                        <span className="text-muted-foreground/70">已注销</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className="inline-flex items-center rounded-full border border-border bg-background/40 px-2 py-0.5 text-[10px] text-foreground/90">
                        {AUDIT_ACTION_LABEL[log.action] ?? log.action}
                      </span>
                      <div className="mt-0.5 font-mono text-[10px] text-muted-foreground/70">
                        {log.action}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="text-foreground/90">
                        {log.targetType
                          ? AUDIT_TARGET_LABEL[log.targetType] ?? log.targetType
                          : "—"}
                      </div>
                      {log.targetId && (
                        <div className="font-mono text-[10px] text-muted-foreground/70">
                          {log.targetId.slice(0, 14)}…
                        </div>
                      )}
                      {targetLink && (
                        <Link
                          href={targetLink}
                          className="text-[11px] text-primary hover:underline"
                        >
                          查看 →
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[11px]">
                      {log.metadata ? (
                        <pre className="max-h-40 max-w-xs overflow-auto whitespace-pre-wrap break-words rounded bg-background/40 p-1.5 text-[10px] text-muted-foreground">
                          {JSON.stringify(log.metadata, null, 1)}
                        </pre>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[10px] text-muted-foreground">
                      {log.ip ?? "—"}
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    无符合条件的审计记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            actor={actor}
            action={action}
            targetType={targetType}
            from={sp.from}
            to={sp.to}
          />
        )}
      </div>
    </>
  );
}

function Labeled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  actor,
  action,
  targetType,
  from,
  to,
}: {
  page: number;
  totalPages: number;
  actor?: string;
  action?: string;
  targetType?: string;
  from?: string;
  to?: string;
}) {
  const base = new URLSearchParams();
  if (actor) base.set("actor", actor);
  if (action) base.set("action", action);
  if (targetType) base.set("targetType", targetType);
  if (from) base.set("from", from);
  if (to) base.set("to", to);
  const href = (p: number) => {
    const params = new URLSearchParams(base);
    params.set("page", String(p));
    return `/admin/audit-logs?${params.toString()}`;
  };
  return (
    <div className="flex items-center justify-between text-xs text-muted-foreground">
      <span>
        第 {page} / {totalPages} 页
      </span>
      <div className="flex gap-2">
        <Link
          href={href(Math.max(1, page - 1))}
          aria-disabled={page <= 1}
          className={cn(
            "rounded-full border border-border px-3 py-1",
            page <= 1
              ? "pointer-events-none opacity-40"
              : "hover:bg-muted/60 hover:text-foreground",
          )}
        >
          上一页
        </Link>
        <Link
          href={href(Math.min(totalPages, page + 1))}
          aria-disabled={page >= totalPages}
          className={cn(
            "rounded-full border border-border px-3 py-1",
            page >= totalPages
              ? "pointer-events-none opacity-40"
              : "hover:bg-muted/60 hover:text-foreground",
          )}
        >
          下一页
        </Link>
      </div>
    </div>
  );
}
