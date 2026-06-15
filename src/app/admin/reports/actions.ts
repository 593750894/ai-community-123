"use server";

import { revalidatePath } from "next/cache";

import { requireMod } from "@/lib/auth/guard";
import {
  adminClaimReport,
  adminReleaseReport,
  adminResolveReport,
} from "@/lib/reports/actions";

/**
 * Server-action wrappers for the /admin/reports table buttons.
 *
 * Stage 17.1：开放给 MOD + ADMIN。表单 action 形式 = 不需要 JS，按提交即可执行。
 * 任何业务异常都吞掉（页面刷新会重拉最新 status），失败用户至少能看到状态未变。
 */

function revalidateReports() {
  revalidatePath("/admin/reports");
  revalidatePath("/admin");
}

export async function adminDismissReportFormAction(
  formData: FormData,
): Promise<void> {
  const actor = await requireMod();
  const id = formData.get("id");
  const resolution = formData.get("resolution");
  if (typeof id !== "string" || !id) return;
  try {
    await adminResolveReport(
      id,
      {
        status: "DISMISSED",
        resolution:
          typeof resolution === "string" && resolution.length > 0
            ? resolution
            : undefined,
      },
      actor.id,
    );
  } catch (err) {
    console.error("[admin/reports] dismiss failed", err);
  }
  revalidateReports();
}

export async function adminResolveReportFormAction(
  formData: FormData,
): Promise<void> {
  const actor = await requireMod();
  const id = formData.get("id");
  const resolution = formData.get("resolution");
  const deleteTarget = formData.get("deleteTarget") === "on";
  if (typeof id !== "string" || !id) return;
  try {
    await adminResolveReport(
      id,
      {
        status: "RESOLVED",
        resolution:
          typeof resolution === "string" && resolution.length > 0
            ? resolution
            : undefined,
        deleteTarget,
      },
      actor.id,
    );
  } catch (err) {
    console.error("[admin/reports] resolve failed", err);
  }
  revalidateReports();
}

/** Stage 17.1：认领举报（PENDING → REVIEWING + assignedToId）。 */
export async function adminClaimReportFormAction(
  formData: FormData,
): Promise<void> {
  const actor = await requireMod();
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;
  try {
    await adminClaimReport(id, actor.id);
  } catch (err) {
    console.error("[admin/reports] claim failed", err);
  }
  revalidateReports();
}

/** Stage 17.1：释放认领（REVIEWING → PENDING）。仅认领者本人或 ADMIN 可执行。 */
export async function adminReleaseReportFormAction(
  formData: FormData,
): Promise<void> {
  const actor = await requireMod();
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;
  try {
    await adminReleaseReport(id, { id: actor.id, role: actor.role });
  } catch (err) {
    console.error("[admin/reports] release failed", err);
  }
  revalidateReports();
}
