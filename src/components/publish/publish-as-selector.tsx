"use client";

import { useState } from "react";
import { BadgeCheck, Building2, User as UserIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Stage 11.3：发布身份选择器（个人 / 企业）。
 *
 * - 通过 hidden input `organizationId` 把选中身份带进 form。
 * - `PERSONAL` 视作 null（后端 resolveOrgAttribution 会解析）。
 * - 用户未加入任何企业时整个组件不渲染，避免视觉噪音。
 *
 * 配合：src/lib/organizations/content-attribution.ts → listMyPostableOrganizations。
 */
export type PublishOrgOption = {
  id: string;
  name: string;
  logo: string | null;
  isVerified: boolean;
  role: "OWNER" | "ADMIN" | "MEMBER";
};

const ROLE_LABEL: Record<PublishOrgOption["role"], string> = {
  OWNER: "拥有者",
  ADMIN: "管理员",
  MEMBER: "成员",
};

export function PublishAsSelector({
  organizations,
  defaultOrgId,
  label = "发布身份",
  hint = "以企业身份发布时，卡片将展示企业品牌；点赞 / 通知 / 销售款仍归你本人。",
}: {
  organizations: PublishOrgOption[];
  defaultOrgId?: string | null;
  label?: string;
  hint?: string;
}) {
  const [selectedId, setSelectedId] = useState<string>(
    defaultOrgId && organizations.some((o) => o.id === defaultOrgId)
      ? defaultOrgId
      : "PERSONAL",
  );

  if (organizations.length === 0) {
    // 用户未加入任何企业 → 隐式个人身份；不渲染 UI，但仍要把 hidden field 提交，否则后端可能误判
    return (
      <input type="hidden" name="organizationId" value="PERSONAL" />
    );
  }

  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <input type="hidden" name="organizationId" value={selectedId} />
      <div className="grid gap-1.5 sm:grid-cols-2">
        <OptionTile
          active={selectedId === "PERSONAL"}
          onClick={() => setSelectedId("PERSONAL")}
        >
          <span className="flex size-7 items-center justify-center rounded-full bg-muted/60">
            <UserIcon className="size-3.5 text-muted-foreground" />
          </span>
          <span className="flex-1 truncate">
            <span className="block text-sm font-medium text-foreground/95">个人身份</span>
            <span className="block text-[11px] text-muted-foreground">以你的主页身份发布</span>
          </span>
        </OptionTile>
        {organizations.map((org) => (
          <OptionTile
            key={org.id}
            active={selectedId === org.id}
            onClick={() => setSelectedId(org.id)}
          >
            {org.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={org.logo}
                alt={org.name}
                className="size-7 shrink-0 rounded-md border border-border object-cover"
              />
            ) : (
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
                <Building2 className="size-3.5 text-primary" />
              </span>
            )}
            <span className="flex-1 truncate">
              <span className="flex items-center gap-1 text-sm font-medium text-foreground/95">
                <span className="truncate">{org.name}</span>
                {org.isVerified && (
                  <BadgeCheck className="size-3.5 shrink-0 text-emerald-400" aria-label="已认证企业" />
                )}
              </span>
              <span className="block text-[11px] text-muted-foreground">
                {ROLE_LABEL[org.role]}
              </span>
            </span>
          </OptionTile>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground/70">{hint}</p>
    </div>
  );
}

function OptionTile({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all",
        active
          ? "border-primary/60 bg-primary/10 ring-1 ring-primary/30"
          : "border-border bg-card/40 hover:border-border hover:bg-muted/40",
      )}
    >
      {children}
    </button>
  );
}
