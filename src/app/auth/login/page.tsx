import Link from "next/link";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = {
  title: "登录 — SeedLand · V",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await getSession();
  const params = await searchParams;
  const next = params?.next && params.next.startsWith("/") ? params.next : null;

  if (session) {
    redirect(next ?? `/profile/${session.userId}`);
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            登录 SeedLand · V
          </h1>
          <p className="text-sm text-muted-foreground">
            欢迎回来，继续你的 AI 视频创作旅程。
          </p>
        </div>

        {next && (
          <p className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-center text-xs text-primary">
            登录后将带你回到 <span className="font-medium">{next}</span>
          </p>
        )}

        <div className="rounded-2xl border border-border/60 bg-card/50 p-6 shadow-sm">
          <LoginForm redirectTo={next ?? undefined} />
        </div>

        <p className="text-center text-sm text-muted-foreground">
          还没有账号？{" "}
          <Link
            href="/auth/register"
            className="text-primary hover:underline underline-offset-4"
          >
            立即注册
          </Link>
        </p>
      </div>
    </div>
  );
}
