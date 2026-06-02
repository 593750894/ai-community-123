"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { UserListCard } from "@/components/follows/user-list-card";
import type { FollowUserSummary } from "@/lib/follows/queries";

interface UserListProps {
  endpoint: string;
  initialItems: FollowUserSummary[];
  initialCursor: string | null;
  initialHasMore: boolean;
  signedIn: boolean;
  viewerId: string | null;
  loginNext: string;
}

interface ApiSuccess {
  success: boolean;
  data?: {
    items: FollowUserSummary[];
    nextCursor: string | null;
    hasMore: boolean;
  };
}

export function UserList({
  endpoint,
  initialItems,
  initialCursor,
  initialHasMore,
  signedIn,
  viewerId,
  loginNext,
}: UserListProps) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    if (!cursor || !hasMore || loading) return;
    setLoading(true);
    try {
      const url = new URL(endpoint, window.location.origin);
      url.searchParams.set("cursor", cursor);
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as ApiSuccess;
      if (json.success && json.data) {
        setItems((prev) => [...prev, ...json.data!.items]);
        setCursor(json.data.nextCursor);
        setHasMore(json.data.hasMore);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {items.map((u) => (
        <UserListCard
          key={u.id}
          user={u}
          signedIn={signedIn}
          viewerId={viewerId}
          loginNext={loginNext}
        />
      ))}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadMore}
            disabled={loading}
          >
            {loading ? "加载中…" : "加载更多"}
          </Button>
        </div>
      )}
    </div>
  );
}
