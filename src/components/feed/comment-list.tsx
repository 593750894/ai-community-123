import Link from "next/link";

import { formatRelativeTime } from "@/lib/utils";

export type CommentItem = {
  id: string;
  content: string;
  createdAt: Date | string;
  author: {
    id: string;
    name: string;
    username: string;
    avatar: string | null;
  };
};

export function CommentList({ comments }: { comments: CommentItem[] }) {
  if (comments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-card/20 px-6 py-10 text-center text-sm text-muted-foreground">
        还没有人评论，来抢沙发吧。
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {comments.map((c) => (
        <li
          key={c.id}
          className="rounded-xl border border-border/60 bg-card/40 p-4"
        >
          <div className="flex items-center gap-2 text-xs">
            {c.author.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={c.author.avatar}
                alt={c.author.name}
                className="size-6 rounded-full border border-border/60"
              />
            ) : (
              <span className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
                {c.author.name.slice(0, 1)}
              </span>
            )}
            <Link
              href={`/profile/${c.author.id}`}
              className="font-medium text-foreground/90 transition-colors hover:text-primary"
            >
              {c.author.name}
            </Link>
            <span className="text-muted-foreground/70">
              @{c.author.username}
            </span>
            <span className="ml-auto tabular-nums text-muted-foreground">
              {formatRelativeTime(c.createdAt)}
            </span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {c.content}
          </p>
        </li>
      ))}
    </ul>
  );
}
