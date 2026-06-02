import Link from "next/link";
import { Briefcase } from "lucide-react";

import { FollowButton } from "@/components/follows/follow-button";
import type { FollowUserSummary } from "@/lib/follows/queries";

/** 关注/粉丝列表里的单条用户卡片 */
export function UserListCard({
  user,
  signedIn,
  viewerId,
  loginNext,
}: {
  user: FollowUserSummary;
  signedIn: boolean;
  viewerId: string | null;
  loginNext: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card/40 p-4 transition-colors hover:border-primary/40">
      <Link
        href={`/profile/${user.id}`}
        className="shrink-0"
        aria-label={user.name}
      >
        {user.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatar}
            alt={user.name}
            className="size-12 rounded-xl border border-border/60 object-cover"
          />
        ) : (
          <span className="flex size-12 items-center justify-center rounded-xl bg-muted text-sm font-medium text-foreground">
            {user.name.slice(0, 1)}
          </span>
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link
            href={`/profile/${user.id}`}
            className="truncate text-sm font-semibold hover:text-primary"
          >
            {user.name}
          </Link>
          <span className="text-[11px] text-muted-foreground">
            @{user.username}
          </span>
          {user.industryRole && (
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
              <Briefcase className="size-2.5" />
              {user.industryRole}
            </span>
          )}
        </div>
        {user.bio && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {user.bio}
          </p>
        )}
      </div>
      <FollowButton
        targetUserId={user.id}
        initialFollowing={user.isFollowing}
        signedIn={signedIn}
        isSelf={viewerId === user.id}
        loginNext={loginNext}
        size="sm"
        variant="outline"
      />
    </div>
  );
}
