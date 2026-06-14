import Link from "next/link";
import {
  FileText,
  Film,
  Hash,
  Search as SearchIcon,
  User as UserIcon,
  Wrench,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { CountText } from "@/components/ui/count-text";
import { EmptyState } from "@/components/ui/empty-state";
import {
  SEARCH_TYPES,
  searchAll,
  type SearchHit,
  type SearchType,
} from "@/lib/search";
import { cn } from "@/lib/utils";

import { Highlight } from "./highlight";

export const dynamic = "force-dynamic";

const TYPE_TABS: { key: "all" | SearchType; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "post", label: "帖子" },
  { key: "work", label: "作品" },
  { key: "user", label: "创作者" },
  { key: "channel", label: "频道" },
  { key: "tool", label: "工具" },
];

function tabHref(q: string, type: "all" | SearchType): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (type !== "all") params.set("type", type);
  const qs = params.toString();
  return qs ? `/search?${qs}` : "/search";
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const rawType = sp.type ?? "all";
  const activeType: "all" | SearchType =
    rawType !== "all" && (SEARCH_TYPES as string[]).includes(rawType)
      ? (rawType as SearchType)
      : "all";

  const typesArg =
    activeType === "all" ? undefined : ([activeType] as SearchType[]);

  const result = q
    ? await searchAll(q, { types: typesArg, limit: 20 })
    : {
        query: "",
        totals: { post: 0, work: 0, user: 0, channel: 0, tool: 0 },
        hits: [],
      };

  const totalAll =
    result.totals.post +
    result.totals.work +
    result.totals.user +
    result.totals.channel +
    result.totals.tool;

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        eyebrow="搜索"
        title={q ? `“${q}” 的搜索结果` : "搜索"}
        description={
          q
            ? `共找到 ${totalAll} 条匹配。按类别筛选可缩小范围。`
            : "在顶部搜索框输入关键词，或按 / 快速聚焦。"
        }
      />

      <div className="flex flex-col gap-5 px-4 py-5 sm:px-8 sm:py-6">
        {q ? (
          <>
            <div className="-mx-4 flex items-center gap-1 overflow-x-auto border-b border-border px-4 pb-2 sm:-mx-8 sm:px-8">
              {TYPE_TABS.map((t) => {
                const count =
                  t.key === "all"
                    ? totalAll
                    : result.totals[t.key as SearchType];
                const active = activeType === t.key;
                return (
                  <Link
                    key={t.key}
                    href={tabHref(q, t.key)}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                      active
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                    )}
                  >
                    {t.label}
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px]",
                        active
                          ? "bg-background/60 text-foreground/80"
                          : "bg-muted/60 text-muted-foreground",
                      )}
                    >
                      {count}
                    </span>
                  </Link>
                );
              })}
            </div>

            {result.hits.length === 0 ? (
              <EmptyState
                icon={SearchIcon}
                title={`没有找到与 “${q}” 相关的内容`}
                description="试试更短的关键词、切换类别，或检查是否有错别字。"
              />
            ) : (
              <ResultGroups hits={result.hits} q={q} activeType={activeType} />
            )}
          </>
        ) : (
          <EmptyState
            icon={SearchIcon}
            title="输入关键词开始搜索"
            description="支持检索帖子、作品、创作者、频道与工具。"
          />
        )}
      </div>
    </div>
  );
}

function ResultGroups({
  hits,
  q,
  activeType,
}: {
  hits: SearchHit[];
  q: string;
  activeType: "all" | SearchType;
}) {
  const groups: { type: SearchType; label: string; items: SearchHit[] }[] = (
    [
      { type: "post", label: "帖子" },
      { type: "work", label: "作品" },
      { type: "user", label: "创作者" },
      { type: "channel", label: "频道" },
      { type: "tool", label: "工具" },
    ] as const
  )
    .map((g) => ({
      type: g.type,
      label: g.label,
      items: hits.filter((h) => h.type === g.type),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-7">
      {groups.map((g) => (
        <section key={g.type} className="flex flex-col gap-3">
          {activeType === "all" && (
            <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              {g.label}
              <span className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px]">
                {g.items.length}
              </span>
            </h2>
          )}
          <ul className="flex flex-col gap-2">
            {g.items.map((hit) => (
              <li key={`${hit.type}:${hit.id}`}>
                <ResultRow hit={hit} q={q} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ResultRow({ hit, q }: { hit: SearchHit; q: string }) {
  switch (hit.type) {
    case "post":
      return (
        <Link
          href={hit.href}
          className="block rounded-2xl border border-border bg-card/30 p-4 transition-colors hover:border-primary/40 hover:bg-card/60"
        >
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <FileText className="size-3" />
            <span>帖子</span>
            <span>·</span>
            <Link
              href={`/community/${hit.channel.slug}`}
              className="hover:text-foreground"
            >
              {hit.channel.name}
            </Link>
            <span>·</span>
            <span>{hit.author.name}</span>
          </div>
          <div className="text-sm font-medium">
            <Highlight text={hit.title} query={q} />
          </div>
          {hit.snippet && (
            <p className="mt-1 text-xs text-muted-foreground">
              <Highlight text={hit.snippet} query={q} />
            </p>
          )}
          <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
            <span><CountText value={hit.likeCount} /> 赞</span>
            <span><CountText value={hit.commentCount} /> 评论</span>
          </div>
        </Link>
      );
    case "work":
      return (
        <Link
          href={hit.href}
          className="flex gap-3 rounded-2xl border border-border bg-card/30 p-3 transition-colors hover:border-primary/40 hover:bg-card/60"
        >
          <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/30 text-muted-foreground">
            {hit.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hit.thumbnailUrl}
                alt={hit.title}
                className="size-full object-cover"
              />
            ) : (
              <Film className="size-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              <Film className="size-3" />
              <span>作品</span>
              <span>·</span>
              <span>{hit.author.name}</span>
              <Badge variant="outline" size="sm">
                {hit.category}
              </Badge>
            </div>
            <div className="text-sm font-medium">
              <Highlight text={hit.title} query={q} />
            </div>
            {hit.snippet && (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                <Highlight text={hit.snippet} query={q} />
              </p>
            )}
          </div>
        </Link>
      );
    case "user":
      return (
        <Link
          href={hit.href}
          className="flex items-center gap-3 rounded-2xl border border-border bg-card/30 p-3 transition-colors hover:border-primary/40 hover:bg-card/60"
        >
          <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted/40 text-muted-foreground">
            {hit.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hit.avatar}
                alt={hit.title}
                className="size-full object-cover"
              />
            ) : (
              <UserIcon className="size-4" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Highlight text={hit.title} query={q} />
              <span className="text-xs text-muted-foreground">
                @<Highlight text={hit.username} query={q} />
              </span>
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {hit.industryRole ?? hit.snippet ?? "AI 视频创作者"}
            </div>
          </div>
        </Link>
      );
    case "channel":
      return (
        <Link
          href={hit.href}
          className="flex items-center gap-3 rounded-2xl border border-border bg-card/30 p-3 transition-colors hover:border-primary/40 hover:bg-card/60"
        >
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-md border text-base"
            style={{
              borderColor: `${hit.color}55`,
              backgroundColor: `${hit.color}1a`,
              color: hit.color,
            }}
          >
            {hit.icon ?? <Hash className="size-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">
              <Highlight text={hit.title} query={q} />
              <span className="ml-2 text-xs text-muted-foreground">
                /{hit.slug}
              </span>
            </div>
            {hit.snippet && (
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                <Highlight text={hit.snippet} query={q} />
              </p>
            )}
            <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
              <span><CountText value={hit.postCount} /> 帖子</span>
              <span><CountText value={hit.memberCount} /> 成员</span>
            </div>
          </div>
        </Link>
      );
    case "tool":
      return (
        <Link
          href={hit.href}
          className="flex items-center gap-3 rounded-2xl border border-border bg-card/30 p-3 transition-colors hover:border-primary/40 hover:bg-card/60"
        >
          <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/30 text-muted-foreground">
            {hit.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hit.logoUrl}
                alt={hit.title}
                className="size-full object-contain"
              />
            ) : (
              <Wrench className="size-4" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
              <Highlight text={hit.title} query={q} />
              <Badge variant="outline" size="sm">
                {hit.category}
              </Badge>
              <Badge variant="ghost" size="sm">
                {hit.pricing}
              </Badge>
            </div>
            {hit.snippet && (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                <Highlight text={hit.snippet} query={q} />
              </p>
            )}
          </div>
        </Link>
      );
  }
}
