import Link from "next/link";
import {
  ArrowUpRight,
  Crown,
  Flame,
  Hash,
  Sparkles,
  Trophy,
} from "lucide-react";

import { FollowButton } from "@/components/follows/follow-button";

export type RightPanelCreator = {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
  industryRole: string | null;
  postCount: number;
  workCount: number;
  isFollowing: boolean;
};

export type RightPanelTag = {
  tag: string;
  count: number;
};

export function RightPanel({
  popularTags,
  activeCreators,
  viewerId,
  signedIn,
}: {
  popularTags: RightPanelTag[];
  activeCreators: RightPanelCreator[];
  viewerId: string | null;
  signedIn: boolean;
}) {
  return (
    <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-80 shrink-0 overflow-y-auto border-l border-border/60 bg-background/40 px-4 py-5 xl:block">
      <Section icon={Flame} title="热门话题">
        {popularTags.length === 0 ? (
          <EmptyHint>暂无热门话题</EmptyHint>
        ) : (
          <ul className="space-y-1">
            {popularTags.map((t, idx) => (
              <li key={t.tag}>
                <Link
                  href={`/search?q=${encodeURIComponent(t.tag)}`}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50"
                >
                  <span
                    className={`w-5 text-center text-xs font-semibold tabular-nums ${
                      idx < 3 ? "text-primary/70" : "text-muted-foreground/60"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <Hash className="size-3 text-muted-foreground/60" />
                  <span className="flex-1 truncate text-sm text-foreground/70">
                    {t.tag}
                  </span>
                  {t.count > 0 && (
                    <span className="text-[11px] text-muted-foreground/60 tabular-nums">
                      {t.count}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section icon={Crown} title="活跃创作者">
        {activeCreators.length === 0 ? (
          <EmptyHint>暂无活跃创作者</EmptyHint>
        ) : (
          <ul className="space-y-1">
            {activeCreators.map((c, idx) => (
              <li key={c.id}>
                <div className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50">
                  <Link
                    href={`/profile/${c.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <div className="relative shrink-0">
                      {c.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.avatar}
                          alt={c.name}
                          className="size-9 rounded-full border border-border/60 object-cover"
                        />
                      ) : (
                        <span className="flex size-9 items-center justify-center rounded-full bg-muted text-sm font-medium text-foreground">
                          {c.name.slice(0, 1)}
                        </span>
                      )}
                      {idx === 0 && (
                        <Trophy className="absolute -right-1 -top-1 size-3.5 text-amber-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{c.name}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {c.industryRole ? `${c.industryRole} · ` : ""}
                        {c.postCount} 帖 · {c.workCount} 作
                      </div>
                    </div>
                  </Link>
                  <FollowButton
                    targetUserId={c.id}
                    initialFollowing={c.isFollowing}
                    signedIn={signedIn}
                    isSelf={viewerId === c.id}
                    size="sm"
                    variant="compact"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Link
        href="/community/creator-program"
        aria-label="加入创作者计划"
        className="mt-6 block rounded-lg border border-border/60 bg-gradient-to-br from-primary/10 via-card/40 to-card/40 p-4 transition-colors hover:border-primary/40 hover:bg-primary/5"
      >
        <div className="mb-2 flex items-center gap-2 text-xs text-primary/80">
          <Sparkles className="size-3.5" />
          创作者计划
        </div>
        <div className="text-sm font-medium">分成 + 流量扶持</div>
        <div className="mt-1 text-[11px] text-muted-foreground">
          注册成为认证创作者，享受官方分成与首页推荐位曝光。
        </div>
        <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary/80">
          了解更多 <ArrowUpRight className="size-3" />
        </span>
      </Link>

      <div className="mt-6 flex flex-wrap gap-x-3 gap-y-1 px-1 text-[11px] text-muted-foreground/60">
        <FooterLink href="/about">关于</FooterLink>
        <FooterLink href="/community/rules">社区公约</FooterLink>
        <FooterLink href="/legal/terms">服务条款</FooterLink>
        <FooterLink href="/legal/privacy">隐私政策</FooterLink>
        <FooterLink href="/contact">联系我们</FooterLink>
        <span>© 2026 SeedLand</span>
      </div>
    </aside>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5">
      <div className="mb-2 flex items-center gap-1.5 px-2 text-xs font-semibold tracking-wide text-foreground/90">
        <Icon className="size-3.5 text-primary" />
        {title}
      </div>
      {children}
    </section>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-border/40 px-3 py-4 text-center text-xs text-muted-foreground/70">
      {children}
    </div>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="transition-colors hover:text-foreground/80"
    >
      {children}
    </Link>
  );
}
