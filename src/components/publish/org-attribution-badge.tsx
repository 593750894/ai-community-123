import Link from "next/link";
import { BadgeCheck, Building2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Stage 11.3：内容卡片上的「企业归属」徽章。
 *
 * - 用于 PostCard / WorkCard / CollaborationCard / WorkflowItemCard，
 *   作为「作者旁」的副标识 ——「@user · 来自 [企业名] V」。
 * - V badge 表示企业认证（Organization.isVerified=true）。
 * - 点击跳企业公开主页 `/organizations/[slug]`。
 *
 * 设计：徽章是辅助信息，不抢占视觉中心；作者头像 + 名字仍是主标识。
 */
export type OrgAttribution = {
  id: string;
  slug: string;
  name: string;
  logo: string | null;
  isVerified: boolean;
};

export function OrgAttributionBadge({
  org,
  size = "sm",
  className,
}: {
  org: OrgAttribution;
  size?: "xs" | "sm";
  className?: string;
}) {
  const px = size === "xs" ? "px-1.5 py-0.5" : "px-2 py-0.5";
  const text = size === "xs" ? "text-[10px]" : "text-[11px]";
  const logo = size === "xs" ? "size-3" : "size-3.5";
  const check = size === "xs" ? "size-2.5" : "size-3";

  return (
    <Link
      href={`/organizations/${org.slug}`}
      className={cn(
        "inline-flex max-w-[150px] items-center gap-1 rounded-full border border-border bg-muted/40 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground",
        px,
        text,
        className,
      )}
      title={`来自企业：${org.name}`}
    >
      {org.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={org.logo}
          alt=""
          className={cn("shrink-0 rounded-sm object-cover", logo)}
        />
      ) : (
        <Building2 className={cn("shrink-0 text-primary", logo)} aria-hidden />
      )}
      <span className="truncate">{org.name}</span>
      {org.isVerified && (
        <BadgeCheck
          className={cn("shrink-0 text-emerald-400", check)}
          aria-label="已认证企业"
        />
      )}
    </Link>
  );
}
