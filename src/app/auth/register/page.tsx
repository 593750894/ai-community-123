import Link from "next/link";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata = {
  title: "注册 — SeedLand · V",
};

export default async function RegisterPage() {
  const session = await getSession();
  if (session) {
    redirect(`/profile/${session.userId}`);
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            创建你的 SeedLand 账号
          </h1>
          <p className="text-sm text-muted-foreground">
            加入 AI 视频创作社区，发布作品、参与协作。
          </p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/50 p-6 shadow-sm">
          <RegisterForm />
        </div>

        <p className="text-center text-sm text-muted-foreground">
          已经有账号？{" "}
          <Link
            href="/auth/login"
            className="text-primary hover:underline underline-offset-4"
          >
            立即登录
          </Link>
        </p>
      </div>
    </div>
  );
}
