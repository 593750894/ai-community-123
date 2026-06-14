import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-border bg-muted/50 text-muted-foreground",
        primary: "border-primary/30 bg-primary/10 text-primary",
        accent: "border-tag-amber-fg/40 bg-tag-amber-bg/10 text-tag-amber-fg dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-tag-amber-fg",
        cyan: "border-tag-cyan-fg/40 bg-tag-cyan-bg/10 text-tag-cyan-fg dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:text-tag-cyan-fg",
        success: "border-tag-emerald-fg/40 bg-tag-emerald-bg/10 text-tag-emerald-fg dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-tag-emerald-fg",
        warning: "border-tag-amber-fg/40 bg-tag-amber-bg/10 text-tag-amber-fg dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-tag-amber-fg",
        destructive: "border-destructive/40 bg-destructive/10 text-destructive",
        outline: "border-border bg-transparent text-muted-foreground",
        ghost: "border-transparent bg-transparent text-muted-foreground",
      },
      size: {
        sm: "h-4 px-1.5 text-[10px]",
        md: "h-5 px-2 text-[11px]",
        lg: "h-6 px-2.5 text-xs",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  asChild?: boolean;
}

export function Badge({
  className,
  variant,
  size,
  ...props
}: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { badgeVariants };
