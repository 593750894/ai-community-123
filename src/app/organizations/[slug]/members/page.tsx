import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Building2, UserPlus, Users } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { InviteMemberForm } from "@/components/organizations/invite-member-form";
import { Badge } from "@/components/ui/badge";
import { getSession } from "@/lib/auth/session";
import {
  getOrganizationBySlug,
  getViewerMembership,
  listOrganizationInvites,
  listOrganizationMembers,
} from "@/lib/organizations/queries";
import {
  ORG_INVITE_STATUS_LABEL,
  ORG_ROLE_LABEL,
} from "@/lib/organizations/schemas";
import {
  cancelInviteAction,
  removeMemberAction,
  updateMemberRoleAction,
} from "@/lib/organizations/server-actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function OrganizationMembersPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await getSession();
  if (!session) {
    redirect(`/auth/login?next=/organizations/${encodeURIComponent(slug)}/members`);
  }
  const org = await getOrganizationBySlug(slug);
  if (!org) notFound();

  const membership = await getViewerMembership(org.id, session.userId);
  if (!membership) {
    // 非成员看不到成员页 → 跳到详情页
    redirect(`/organizations/${slug}`);
  }
  const canManage = membership.role === "OWNER" || membership.role === "ADMIN";

  const [members, invites] = await Promise.all([
    listOrganizationMembers(org.id),
    canManage ? listOrganizationInvites(org.id) : Promise.resolve([]),
  ]);

  const pendingInvites = invites.filter((i) => i.status === "PENDING");
  const historicalInvites = invites.filter((i) => i.status !== "PENDING");

  return (
    <>
      <PageHeader
        eyebrow={org.name}
        title="成员管理"
        description={
          canManage
            ? "邀请新成员加入，或调整现有成员的角色。"
            : "查看企业目前的成员列表。"
        }
        actions={
          <Link
            href={`/organizations/${org.slug}`}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ← 返回企业主页
          </Link>
        }
      />

      <div className="space-y-6 px-4 py-5 sm:px-8 sm:py-6">
        {canManage && (
          <section className="rounded-xl border border-border/60 bg-card/40 p-4">
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-medium">
              <UserPlus className="size-4 text-muted-foreground" /> 邀请成员
            </h2>
            <InviteMemberForm orgId={org.id} slug={org.slug} />
          </section>
        )}

        <section>
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-medium">
            <Users className="size-4 text-muted-foreground" /> 现有成员（{members.length}）
          </h2>
          <div className="overflow-hidden rounded-xl border border-border/60">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">成员</th>
                  <th className="px-3 py-2 text-left">角色</th>
                  <th className="px-3 py-2 text-left">加入时间</th>
                  {canManage && <th className="px-3 py-2 text-right">操作</th>}
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const isOwner = m.role === "OWNER";
                  const isSelf = m.user.id === session.userId;
                  return (
                    <tr
                      key={m.user.id}
                      className="border-t border-border/40 hover:bg-muted/20"
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="flex size-7 items-center justify-center rounded-full bg-muted/40 text-[10px] text-muted-foreground">
                            {m.user.avatar ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={m.user.avatar}
                                alt={m.user.name}
                                className="size-full rounded-full object-cover"
                              />
                            ) : (
                              m.user.name.slice(0, 1)
                            )}
                          </div>
                          <div>
                            <Link
                              href={`/profile/${m.user.id}`}
                              className="font-medium hover:text-primary"
                            >
                              {m.user.name}
                            </Link>
                            <p className="text-[10px] text-muted-foreground/80">
                              @{m.user.username}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={isOwner ? "primary" : "outline"}>
                          {ORG_ROLE_LABEL[m.role]}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground tabular-nums">
                        {new Date(m.createdAt).toISOString().slice(0, 10)}
                      </td>
                      {canManage && (
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            {/* OWNER 可改其他人 MEMBER/ADMIN；OWNER 自己跳过；OWNER 行不显示操作 */}
                            {!isOwner &&
                              membership.role === "OWNER" &&
                              !isSelf && (
                                <form
                                  action={updateMemberRoleAction}
                                  className="flex items-center gap-1"
                                >
                                  <input type="hidden" name="id" value={org.id} />
                                  <input type="hidden" name="slug" value={org.slug} />
                                  <input
                                    type="hidden"
                                    name="userId"
                                    value={m.user.id}
                                  />
                                  <select
                                    name="role"
                                    defaultValue={m.role}
                                    className="h-7 rounded-md border border-border/60 bg-background/40 px-1 text-[11px]"
                                  >
                                    <option value="MEMBER">成员</option>
                                    <option value="ADMIN">管理员</option>
                                  </select>
                                  <button
                                    className="rounded-md border border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                                    type="submit"
                                  >
                                    更新
                                  </button>
                                </form>
                              )}
                            {!isOwner &&
                              !isSelf &&
                              !(
                                membership.role === "ADMIN" && m.role === "ADMIN"
                              ) && (
                                <form action={removeMemberAction}>
                                  <input type="hidden" name="id" value={org.id} />
                                  <input type="hidden" name="slug" value={org.slug} />
                                  <input
                                    type="hidden"
                                    name="userId"
                                    value={m.user.id}
                                  />
                                  <button
                                    className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[11px] text-rose-300 hover:bg-rose-500/20"
                                    type="submit"
                                  >
                                    移除
                                  </button>
                                </form>
                              )}
                            {isSelf && !isOwner && (
                              <span className="text-[11px] text-muted-foreground/60">
                                你
                              </span>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {canManage && pendingInvites.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-medium">
              待处理邀请（{pendingInvites.length}）
            </h2>
            <div className="overflow-hidden rounded-xl border border-border/60">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">被邀请人</th>
                    <th className="px-3 py-2 text-left">邀请角色</th>
                    <th className="px-3 py-2 text-left">邀请人</th>
                    <th className="px-3 py-2 text-left">发出时间</th>
                    <th className="px-3 py-2 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingInvites.map((iv) => (
                    <tr
                      key={iv.id}
                      className="border-t border-border/40 hover:bg-muted/20"
                    >
                      <td className="px-3 py-2">
                        <Link
                          href={`/profile/${iv.invitee.id}`}
                          className="font-medium hover:text-primary"
                        >
                          {iv.invitee.name}
                        </Link>
                        <p className="text-[10px] text-muted-foreground/80">
                          @{iv.invitee.username}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {ORG_ROLE_LABEL[iv.role]}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        @{iv.inviter.username}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground tabular-nums">
                        {new Date(iv.createdAt).toISOString().slice(0, 10)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <form action={cancelInviteAction}>
                          <input type="hidden" name="inviteId" value={iv.id} />
                          <input type="hidden" name="slug" value={org.slug} />
                          <button className="rounded-md border border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground">
                            撤销
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {canManage && historicalInvites.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-medium">邀请历史</h2>
            <div className="overflow-hidden rounded-xl border border-border/60">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">被邀请人</th>
                    <th className="px-3 py-2 text-left">结果</th>
                    <th className="px-3 py-2 text-left">回复时间</th>
                  </tr>
                </thead>
                <tbody>
                  {historicalInvites.slice(0, 20).map((iv) => (
                    <tr key={iv.id} className="border-t border-border/40">
                      <td className="px-3 py-2">@{iv.invitee.username}</td>
                      <td className="px-3 py-2 text-muted-foreground">
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

        {!canManage && (
          <section className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-4 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <Building2 className="size-3.5" /> 当前以「{ORG_ROLE_LABEL[membership.role]}」身份查看。仅管理员可邀请成员。
            </p>
          </section>
        )}
      </div>
    </>
  );
}
