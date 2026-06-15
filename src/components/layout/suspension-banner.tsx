import { AlertOctagon } from "lucide-react";

import { isUserActivelySuspended } from "@/lib/auth/suspension";

/**
 * Stage 17.5：禁言期间的全局横幅。
 *
 * 渲染条件：
 *   - user.status === "SUSPENDED"
 *   - 且未到期（永久禁言 or suspendedUntil > now）
 *
 * 显示原因 + 到期信息，让用户清楚现状；同时通过 aria-live="polite" 向 SR 报告状态。
 * 不阻挡浏览（read-only by design）。
 */

export interface SuspensionBannerProps {
  user: {
    status: "ACTIVE" | "SUSPENDED" | "BANNED" | "DELETED";
    suspendedUntil: Date | null;
    suspensionReason: string | null;
  } | null;
}

export function SuspensionBanner({ user }: SuspensionBannerProps) {
  if (!user) return null;
  if (!isUserActivelySuspended(user)) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b border-tag-amber-bg bg-tag-amber-bg/40 px-6 py-2.5 text-sm text-tag-amber-fg sm:px-8"
    >
      <div className="mx-auto flex max-w-[1600px] items-start gap-3">
        <AlertOctagon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="flex-1 space-y-0.5">
          <div className="font-medium">
            你的账户当前处于禁言状态，所有发布 / 评论 / 私信 / 互动均被拒绝。
          </div>
          {user.suspensionReason && (
            <div className="text-xs">原因：{user.suspensionReason}</div>
          )}
          <div className="text-xs">
            {user.suspendedUntil ? (
              <>到期时间：{user.suspendedUntil.toLocaleString("zh-CN")}（到期自动解除）</>
            ) : (
              <>到期时间：永久（仅 admin 可解除）</>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
