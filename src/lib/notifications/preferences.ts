import { prisma } from "@/lib/db";
import type { NotificationType } from "@/generated/prisma/client";

import {
  NOTIFICATION_TYPES,
  isGateable,
  type PreferenceMap,
} from "./preferences-meta";

// Stage 9：服务端读写通知偏好。元数据 / 类型常量在 preferences-meta.ts。

export async function getNotificationPreferences(
  userId: string,
): Promise<PreferenceMap> {
  const rows = await prisma.notificationPreference.findMany({
    where: { userId },
    select: { type: true, enabled: true },
  });
  const map = {} as PreferenceMap;
  for (const t of NOTIFICATION_TYPES) {
    map[t] = true;
  }
  for (const r of rows) {
    map[r.type] = r.enabled;
  }
  // SYSTEM 永远显示为 ON。
  map.SYSTEM = true;
  return map;
}

export async function upsertNotificationPreference(
  userId: string,
  type: NotificationType,
  enabled: boolean,
): Promise<void> {
  if (!isGateable(type)) return; // SYSTEM 静默忽略
  await prisma.notificationPreference.upsert({
    where: { userId_type: { userId, type } },
    create: { userId, type, enabled },
    update: { enabled },
  });
}
