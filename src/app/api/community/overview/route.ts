import { getCommunityOverview } from "@/lib/community/queries";
import { success, error } from "@/lib/response";

export async function GET() {
  try {
    const data = await getCommunityOverview();
    return success(data);
  } catch (err) {
    return error(err);
  }
}
