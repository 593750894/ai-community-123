import * as React from "react";

import { cn } from "@/lib/utils";

type CardVariant = "default" | "glass" | "accent" | "dashed" | "plain";

const VARIANT_CLASS: Record<CardVariant, string> = {
  default: "surface-card surface-card-hover",
  glass:
    "surface-glass transition-all hover:-translate-y-0.5 hover:border-primary/50",
  accent: "surface-glass-accent",
  dashed: "surface-dashed",
  plain: "rounded-xl bg-card/30",
};

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  interactive?: boolean;
}

export function Card({
  className,
  variant = "default",
  interactive,
  ...props
}: CardProps) {
  return (
    <div
      data-slot="card"
      className={cn(
        VARIANT_CLASS[variant],
        interactive && "cursor-pointer transition-all hover:-translate-y-0.5",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex flex-col gap-1.5 p-4 sm:p-5", className)}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      data-slot="card-title"
      className={cn("text-base font-semibold leading-tight tracking-tight", className)}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      data-slot="card-description"
      className={cn("text-xs text-muted-foreground", className)}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-content"
      className={cn("p-4 pt-0 sm:p-5 sm:pt-0", className)}
      {...props}
    />
  );
}

export function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center gap-2 border-t border-border/40 p-4 sm:p-5",
        className,
      )}
      {...props}
    />
  );
}
