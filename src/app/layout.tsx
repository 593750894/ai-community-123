import type { Metadata } from "next";

import { MobileBottomNav } from "@/components/layout/mobile-nav";
import { Navbar } from "@/components/layout/navbar";
import { RightPanel } from "@/components/layout/right-panel";
import { Sidebar } from "@/components/layout/sidebar";
import { getCurrentUser } from "@/lib/auth/session";

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
  const user = await getCurrentUser();
  const navbarUser = user
    ? {
        id: user.id,
        username: user.username,
        name: user.name,
        avatar: user.avatar,
      }
    : null;

  return (
    <html
      lang="zh-CN"
      className="dark h-full antialiased"
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <Navbar user={navbarUser} />
        <div className="mx-auto flex w-full max-w-[1600px] flex-1">
          <Sidebar />
          <main className="flex min-w-0 flex-1 flex-col pb-16 lg:pb-0">
            {children}
          </main>
          <RightPanel />
        </div>
        <MobileBottomNav />
      </body>
    </html>
  );
}
