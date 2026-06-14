import Link from "next/link";
import { Inbox } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUser } from "@/lib/auth/guard";
import { listMyInvites } from "@/lib/organizations/queries";
import {
  ORG_INVITE_STATUS_LABEL,
  ORG_ROLE_LABEL,
} from "@/lib/organizations/schemas";
import { respondInviteAction } from "@/lib/organizations/server-actions";

export const dynamic = "force-dynamic";

export default async function MyInvitesPage() {
  const user = await requireUser("/me/organizations/invites");
  const invites = await listMyInvites(user.id);
  const pending = invites.filter((i) => i.status === "PENDING");
  const history = invites.filter((i) => i.status !== "PENDING");

  return (
    <>
      <PageHeader
        eyebrow="邀请收件箱"
        title="企业邀请"
        description="接受邀请加入企业，或拒绝你不感兴趣的邀请。"
        actions={
          <Link
            href="/me/organizations"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ← 返回我的企业
          </Link>
        }
      />

      <div className="space-y-6 px-4 py-5 sm:px-8 sm:py-6">
        <section>
          <h2 className="mb-3 text-sm font-medium">待响应（{pending.length}）</h2>
          {pending.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="没有待响应的邀请"
              description="新邀请会在收到通知后出现在这里。"
            />
          ) : (
            <div className="space-y-3">
              {pending.map((iv) => (
                <article
                  key={iv.id}
                  className="rounded-xl border border-border bg-card/40 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/organizations/${iv.organization.slug}`}
                          className="text-sm font-medium hover:text-primary"
                        >
                          {iv.organization.name}
                        </Link>
                        {iv.organization.isVerified && (
                          <Badge variant="primary" size="sm">
                            认证
                          </Badge>
                        )}
                        <Badge variant="outline" size="sm">
                          邀请角色：{ORG_ROLE_LABEL[iv.role]}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        @{iv.organization.slug} · 由 @{iv.inviter.username} 邀请
                      </p>
                      {iv.message && (
                        <p className="rounded-md border border-border bg-background/40 px-3 py-2 text-xs text-muted-foreground">
                          {iv.message}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <form action={respondInviteAction}>
                        <input type="hidden" name="inviteId" value={iv.id} />
                        <input type="hidden" name="action" value="reject" />
                        <button
                          className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                          type="submit"
                        >
                          拒绝
                        </button>
                      </form>
                      <form action={respondInviteAction}>
                        <input type="hidden" name="inviteId" value={iv.id} />
                        <input type="hidden" name="action" value="accept" />
                        <button
                          className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/80"
                          type="submit"
                        >
                          接受邀请
                        </button>
                      </form>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {history.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-medium">历史记录</h2>
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">企业</th>
                    <th className="px-3 py-2 text-left">角色</th>
                    <th className="px-3 py-2 text-left">状态</th>
                    <th className="px-3 py-2 text-left">回复时间</th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice(0, 30).map((iv) => (
                    <tr
                      key={iv.id}
                      className="border-t border-border hover:bg-muted/20"
                    >
                      <td className="px-3 py-2">
                        <Link
                          href={`/organizations/${iv.organization.slug}`}
                          className="hover:text-primary"
                        >
                          {iv.organization.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {ORG_ROLE_LABEL[iv.role]}
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          variant={
                            iv.status === "ACCEPTED"
                              ? "success"
                              : iv.status === "REJECTED"
                                ? "destructive"
                                : "outline"
                          }
                        >
                          {ORG_INVITE_STATUS_LABEL[iv.status]}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground tabular-nums">
                        {iv.respondedAt
                          ? new Date(iv.respondedAt).toISOString().slice(0, 10)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
