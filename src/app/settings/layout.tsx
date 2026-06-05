import { PageHeader } from "@/components/layout/page-header";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { requireUser } from "@/lib/auth/guard";

// Stage 9：/settings 三块（账户 / 通知 / 隐私）。
// requireUser → 未登录跳 /auth/login?next=/settings；登录后看到 tab 导航。

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser("/settings");

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        eyebrow="账户中心"
        title="设置"
        description="管理你的账户、通知偏好和主页隐私。"
      />
      <SettingsTabs />
      {children}
    </div>
  );
}
