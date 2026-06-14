import * as React from "react";
import { BookOpen, Box, Flame, Handshake, Hash, MessageCircle, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type PillTagTint =
  | "cyan"
  | "blue"
  | "violet"
  | "rose"
  | "amber"
  | "emerald"
  | "slate";

const TINT_CLASS: Record<PillTagTint, string> = {
  cyan: "bg-tag-cyan-bg text-tag-cyan-fg",
  blue: "bg-tag-blue-bg text-tag-blue-fg",
  violet: "bg-tag-violet-bg text-tag-violet-fg",
  rose: "bg-tag-rose-bg text-tag-rose-fg",
  amber: "bg-tag-amber-bg text-tag-amber-fg",
  emerald: "bg-tag-emerald-bg text-tag-emerald-fg",
  slate: "bg-tag-slate-bg text-tag-slate-fg",
};

// DESIGN.md §7 taxonomy → icon convention. Per §2 "Non-color Cue for Taxonomy
// Tags" (WCAG 1.4.1), every pill MUST carry an icon prefix so color-blind users
// have a non-color signal.
const DEFAULT_ICON: Record<PillTagTint, LucideIcon> = {
  cyan: BookOpen,
  blue: Box,
  violet: MessageCircle,
  rose: Flame,
  amber: Handshake,
  emerald: Wrench,
  slate: Hash,
};

const SIZE_CLASS = {
  sm: "px-2 py-0.5 text-[10px] gap-0.5",
  md: "px-2.5 py-0.5 text-[11px] gap-1",
  lg: "px-3 py-1 text-xs gap-1.5",
} as const;

const ICON_SIZE = {
  sm: "size-2.5",
  md: "size-3",
  lg: "size-3.5",
} as const;

export interface PillTagProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  tint: PillTagTint;
  /** Override the lucide icon for this tag. Pass `null` ONLY when you're
   *  certain another non-color cue is already present (e.g. distinct
   *  typography in a typed list); WCAG 1.4.1 expects an icon by default. */
  icon?: LucideIcon | null;
  size?: keyof typeof SIZE_CLASS;
  children: React.ReactNode;
}

export function PillTag({
  tint,
  icon,
  size = "md",
  children,
  className,
  ...rest
}: PillTagProps) {
  const Icon = icon === undefined ? DEFAULT_ICON[tint] : icon;
  return (
    <span
      data-slot="pill-tag"
      className={cn(
        "inline-flex shrink-0 items-center rounded-full font-medium leading-none whitespace-nowrap",
        SIZE_CLASS[size],
        TINT_CLASS[tint],
        className,
      )}
      {...rest}
    >
      {Icon && <Icon className={cn(ICON_SIZE[size], "shrink-0")} aria-hidden />}
      {children}
    </span>
  );
}

export const PILL_TAG_TINTS = Object.keys(TINT_CLASS) as readonly PillTagTint[];

/** Returns the V2 bg+text utility classes for a tint, for non-pill consumers
 *  (e.g. status-toggle buttons, select elements) that need the same
 *  taxonomy color vocabulary without the pill shape. */
export function pillTagTintClass(tint: PillTagTint): string {
  return TINT_CLASS[tint];
}
