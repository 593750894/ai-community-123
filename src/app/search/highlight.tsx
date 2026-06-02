import * as React from "react";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 把 text 内匹配 query 的部分用 <mark> 高亮（大小写不敏感）。
 * 空 query 或 text 时原样返回。
 */
export function Highlight({
  text,
  query,
  className,
}: {
  text: string;
  query: string;
  className?: string;
}) {
  const q = query.trim();
  if (!q || !text) return <span className={className}>{text}</span>;

  const re = new RegExp(`(${escapeRegExp(q)})`, "ig");
  const parts = text.split(re);
  const lower = q.toLowerCase();

  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.toLowerCase() === lower ? (
          <mark
            key={i}
            className="rounded bg-primary/25 px-0.5 text-foreground"
          >
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </span>
  );
}
