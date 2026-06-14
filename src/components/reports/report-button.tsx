"use client";

import { useState } from "react";
import { Flag } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ReportTargetTypeValue } from "@/lib/reports/schemas";

import { ReportDialog } from "./report-dialog";

type Variant = "icon" | "menu-item" | "icon-floating";

interface ReportButtonProps {
  targetType: ReportTargetTypeValue;
  targetId: string;
  /** 目标的所有者 ID —— 等于当前登录用户时整个按钮不渲染 */
  ownerId?: string | null;
  /** 当前登录用户 ID。未登录传 null/undefined：按钮也隐藏（不引导未登录用户举报）。 */
  viewerId?: string | null;
  /** 视觉变体：icon = 紧凑图标，menu-item = 文字行，icon-floating = 卡片右上角绝对定位 */
  variant?: Variant;
  className?: string;
  /** 未登录跳哪个 URL（默认走当前 path） */
  loginNext?: string;
}

/**
 * 举报按钮。
 *
 * 隐藏规则：
 * - 未登录（viewerId 缺失）→ 不渲染（保持 UI 简洁，引导先注册）
 * - 是目标所有者 → 不渲染（防止自举报）
 *
 * 注：collaboration-card 用 Link 包整张卡，使用 variant=icon-floating 自带 stopPropagation。
 */
export function ReportButton({
  targetType,
  targetId,
  ownerId,
  viewerId,
  variant = "icon",
  className,
  loginNext,
}: ReportButtonProps) {
  const [open, setOpen] = useState(false);

  if (!viewerId) return null;
  if (ownerId && ownerId === viewerId) return null;

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  }

  let trigger: React.ReactNode;
  if (variant === "menu-item") {
    trigger = (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive",
          className,
        )}
      >
        <Flag className="size-3.5" />
        举报
      </button>
    );
  } else if (variant === "icon-floating") {
    trigger = (
      <button
        type="button"
        onClick={onClick}
        aria-label="举报"
        title="举报"
        className={cn(
          "absolute right-2 top-2 z-10 inline-flex size-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive",
          className,
        )}
      >
        <Flag className="size-3" />
      </button>
    );
  } else {
    trigger = (
      <button
        type="button"
        onClick={onClick}
        aria-label="举报"
        title="举报"
        className={cn(
          "inline-flex h-7 items-center justify-center rounded-full border border-border bg-transparent px-2 text-[11px] text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive",
          className,
        )}
      >
        <Flag className="size-3" />
      </button>
    );
  }

  return (
    <>
      {trigger}
      <ReportDialog
        open={open}
        onClose={() => setOpen(false)}
        targetType={targetType}
        targetId={targetId}
        loginNext={loginNext}
      />
    </>
  );
}
