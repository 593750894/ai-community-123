import * as React from "react";

import { cn } from "@/lib/utils";

export interface CountTextProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  /** The number to render. Strings are passed through unchanged (useful for
   *  pre-formatted IDs like "ORD-7K2M"). */
  value: number | string;
  /** Force locale for thousand separators. Default "zh-CN". */
  locale?: string;
  /** Abbreviate values ≥ 10k as "1.2万" — useful for view counts / follower counts. */
  abbreviate?: boolean;
}

export function CountText({
  value,
  locale = "zh-CN",
  abbreviate = false,
  className,
  ...rest
}: CountTextProps) {
  let display: string;
  if (typeof value === "string") {
    display = value;
  } else if (abbreviate && Math.abs(value) >= 10_000) {
    const wan = value / 10_000;
    display = `${wan.toFixed(wan >= 100 ? 0 : 1)}万`;
  } else {
    display = value.toLocaleString(locale);
  }

  return (
    <span
      data-slot="count"
      className={cn("tabular-nums", className)}
      {...rest}
    >
      {display}
    </span>
  );
}
