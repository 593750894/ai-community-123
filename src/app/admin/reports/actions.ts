"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/guard";
import { adminResolveReport } from "@/lib/reports/actions";

/**
 * Server-action wrappers for the /admin/reports table buttons.
 *
 * 表单 action 形式 = 不需要 JS，按提交即可执行。
 * 任何业务异常都吞掉（页面刷新会重拉最新 status），失败用户至少能看到状态未变。
 */

export async function adminDismissReportFormAction(
  formData: FormData,
): Promise<void> {
  const admin = await requireAdmin();
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
      admin.id,
    );
  } catch (err) {
    console.error("[admin/reports] dismiss failed", err);
  }
  revalidatePath("/admin/reports");
  revalidatePath("/admin");
}

export async function adminResolveReportFormAction(
  formData: FormData,
): Promise<void> {
  const admin = await requireAdmin();
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
      admin.id,
    );
  } catch (err) {
    console.error("[admin/reports] resolve failed", err);
  }
  revalidatePath("/admin/reports");
  revalidatePath("/admin");
}
