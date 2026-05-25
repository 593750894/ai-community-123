import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const TIME_BUCKETS: Array<[number, string]> = [
  [60, "秒"],
  [60, "分钟"],
  [24, "小时"],
  [7, "天"],
  [4, "周"],
  [12, "月"],
];

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffSec < 30) return "刚刚";

  let value = diffSec;
  let unit = "秒";
  for (const [factor, name] of TIME_BUCKETS) {
    if (value < factor) {
      unit = name;
      break;
    }
    value = Math.floor(value / factor);
    unit = name;
  }
  if (unit === "月" && value >= 12) {
    return `${Math.floor(value / 12)} 年前`;
  }
  return `${value} ${unit}前`;
}
