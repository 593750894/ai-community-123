import { PrivacyForm } from "@/components/settings/privacy-form";
import { requireUser } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export default async function SettingsPrivacyPage() {
  const user = await requireUser("/settings/privacy");
  return (
    <div className="space-y-6 px-6 py-6 sm:px-8">
      <section className="rounded-2xl border border-border bg-card/40 p-5">
        <h2 className="mb-1 text-sm font-medium">主页可见性</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          关闭后，匿名访客打开 /profile/{user.id} 会看到「主页已隐藏」。
          已登录用户和管理员仍能查看。
        </p>
        <PrivacyForm initial={{ isProfilePublic: user.isProfilePublic }} />
      </section>
    </div>
  );
}
