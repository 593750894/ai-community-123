import { error, success } from "@/lib/response";
import { listActiveMembershipPlans } from "@/lib/commerce/queries";

/** GET /api/pricing/plans — 公开可见的会员档位。 */
export async function GET() {
  try {
    const plans = await listActiveMembershipPlans();
    return success({ plans });
  } catch (err) {
    return error(err);
  }
}
