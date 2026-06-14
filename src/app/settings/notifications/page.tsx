import { NotificationPrefsForm } from "@/components/settings/notification-prefs-form";
import { requireUser } from "@/lib/auth/guard";
import { getNotificationPreferences } from "@/lib/notifications/preferences";
import { NOTIFICATION_TYPES } from "@/lib/notifications/preferences-meta";

export const dynamic = "force-dynamic";

export default async function SettingsNotificationsPage() {
  const user = await requireUser("/settings/notifications");
  const prefs = await getNotificationPreferences(user.id);
  return (
    <div className="space-y-6 px-6 py-6 sm:px-8">
      <section className="rounded-2xl border border-border bg-card/40 p-5">
        <h2 className="mb-1 text-sm font-medium">通知偏好</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          关闭后，该类型的新通知不再写入站内信。系统 / 管理员通知无法关闭。
        </p>
        <NotificationPrefsForm
          types={NOTIFICATION_TYPES as readonly string[]}
          initial={prefs}
        />
      </section>
    </div>
  );
}
