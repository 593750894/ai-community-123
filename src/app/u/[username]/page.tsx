import { notFound, redirect } from "next/navigation";

import { prisma } from "@/lib/db";

// Stage 7 · /u/[username] 友好 URL 别名 → /profile/[userId]
// 用 thin RSC page 而不是 next.config rewrites，因为需要 DB 查询。
// 用 302 而不是 308，避免 username 之后允许修改时浏览器仍缓存旧映射。
const USERNAME_RE = /^[A-Za-z0-9_-]{1,64}$/;

export const dynamic = "force-dynamic";

export default async function UsernameAliasPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  if (!USERNAME_RE.test(username)) {
    notFound();
  }
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });
  if (!user) notFound();
  redirect(`/profile/${user.id}`);
}
