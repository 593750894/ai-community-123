import { z } from "zod";

import { requireAuth } from "@/lib/auth/guard";
import { success, error } from "@/lib/response";
import { ValidationError } from "@/lib/errors";
import {
  getNotificationPreferences,
  upsertNotificationPreference,
} from "@/lib/notifications/preferences";
import { NOTIFICATION_TYPES } from "@/lib/notifications/preferences-meta";

export async function GET() {
  try {
    const user = await requireAuth();
    const prefs = await getNotificationPreferences(user.id);
    return success(prefs);
  } catch (err) {
    return error(err);
  }
}

const PutBodySchema = z.object({
  type: z.enum(NOTIFICATION_TYPES),
  enabled: z.boolean(),
});

export async function PUT(request: Request) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const parsed = PutBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("参数校验失败", parsed.error.flatten().fieldErrors);
    }
    await upsertNotificationPreference(
      user.id,
      parsed.data.type,
      parsed.data.enabled,
    );
    return success({ type: parsed.data.type, enabled: parsed.data.enabled });
  } catch (err) {
    return error(err);
  }
}
