import type { Metadata } from "next";

import { MobileBottomNav } from "@/components/layout/mobile-nav";
import { Navbar } from "@/components/layout/navbar";
import { RightPanel } from "@/components/layout/right-panel";
import { Sidebar } from "@/components/layout/sidebar";
import { RealtimeProvider } from "@/components/providers/realtime-provider";
import {
  ThemeProvider,
  themeInitScript,
} from "@/components/providers/theme-provider";
import { getCurrentUser } from "@/lib/auth/session";
import {
  getActiveCreators,
  getHotChannels,
  getPopularTags,
} from "@/lib/community/queries";
import { getFollowingMap } from "@/lib/follows/queries";

import "./globals.css";

export const metadata: Metadata = {
  title: "SeedLand · V — AI 视频创作者的内容社区",
  description:
    "围绕 Seedance 2.0 与主流视频大模型的 AI 视频创作社区：作品广场、项目合作、工具库、模型评测一站式打通。",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [user, hotChannelRows, popularTags, activeCreatorRows] =
    await Promise.all([
      getCurrentUser(),
      getHotChannels(8),
      getPopularTags(6),
      getActiveCreators(4),
    ]);

  const navbarUser = user
    ? {
        id: user.id,
        username: user.username,
        name: user.name,
        avatar: user.avatar,
      }
    : null;

  const sidebarChannels = hotChannelRows.map((c) => ({
    slug: c.slug,
    name: c.name,
    icon: c.icon,
  }));

  const followingMap = await getFollowingMap({
    followerId: user?.id ?? null,
    targetUserIds: activeCreatorRows.map((c) => c.id),
  });

  const rightPanelCreators = activeCreatorRows.map((c) => ({
    id: c.id,
    name: c.name,
    username: c.username,
    avatar: c.avatar,
    industryRole: c.industryRole,
    postCount: c._count.posts,
    workCount: c._count.works,
    isFollowing: followingMap.get(c.id) ?? false,
  }));

  return (
    <html
      lang="zh-CN"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground focus:shadow-lg"
        >
          跳到主要内容
        </a>
        <ThemeProvider defaultTheme="dark">
          <RealtimeProvider enabled={!!user}>
            <Navbar user={navbarUser} />
            <div className="mx-auto flex w-full max-w-[1600px] flex-1">
              <Sidebar
                hotChannels={sidebarChannels}
                popularTags={popularTags}
              />
              <main
                id="main-content"
                className="flex min-w-0 flex-1 flex-col pb-16 lg:pb-0"
              >
                {children}
              </main>
              <RightPanel
                popularTags={popularTags}
                activeCreators={rightPanelCreators}
                viewerId={user?.id ?? null}
                signedIn={!!user}
              />
            </div>
            <MobileBottomNav />
          </RealtimeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
