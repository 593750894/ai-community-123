import * as React from "react";

import { cn } from "@/lib/utils";

const TONE_CLASS = {
  positive: "text-money-positive",
  negative: "text-money-negative",
  neutral: "text-money",
} as const;

// Known ISO-4217 currency codes → display symbols. Lets callers pass either
// the symbol ("¥") or the ISO code ("CNY") and get a consistent symbol render.
// Unknown values are passed through verbatim, matching formatPrice behavior.
const CURRENCY_SYMBOL: Record<string, string> = {
  CNY: "¥",
  RMB: "¥",
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  HKD: "HK$",
  TWD: "NT$",
};

function resolveCurrency(input: string): string {
  if (!input) return input;
  return CURRENCY_SYMBOL[input.toUpperCase()] ?? input;
}

export interface MoneyTextProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  /** Amount in cents. Negative values render with "-" prefix; the sign is
   *  derived from the raw number, not from `tone`. */
  value: number;
  /** Currency prefix — pass either a symbol ("¥", "$") or an ISO-4217 code
   *  ("CNY", "USD"). Known codes are mapped to symbols automatically; unknown
   *  values render verbatim. Default "¥". Pass an empty string to omit. */
  currency?: string;
  /** Force render color. \`neutral\` (default) = deep navy ink; \`positive\`
   *  = emerald; \`negative\` = rose. Sign auto-derives from value. */
  tone?: "positive" | "negative" | "neutral";
  /** Show "+" for non-zero positive values (useful for deltas in tables). */
  showSign?: boolean;
  /** Decimal places. Default 2. Pass 0 for integer amounts (e.g. point balances). */
  fractionDigits?: number;
  /** Force locale. Default "zh-CN" for thousand separators consistent with the rest of the app. */
  locale?: string;
}

const YUAN_DIVISOR = 100;

export function MoneyText({
  value,
  currency = "¥",
  tone = "neutral",
  showSign = false,
  fractionDigits = 2,
  locale = "zh-CN",
  className,
  ...rest
}: MoneyTextProps) {
  const absCents = Math.abs(value);
  const yuan = (absCents / YUAN_DIVISOR).toLocaleString(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  const sign = value < 0 ? "−" : showSign && value > 0 ? "+" : "";
  const symbol = resolveCurrency(currency);

  return (
    <span
      data-slot="money"
      className={cn("tabular-nums", TONE_CLASS[tone], className)}
      {...rest}
    >
      {sign}
      {symbol && (
        <span className="mr-0.5 text-[0.8em] tracking-[0.04em]">{symbol}</span>
      )}
      {yuan}
    </span>
  );
}
