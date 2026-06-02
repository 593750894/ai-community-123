import { success, error } from "@/lib/response";
import { searchAll, SEARCH_TYPES, type SearchType } from "@/lib/search";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? "";
    const typeParam = url.searchParams.get("type");
    const limitParam = url.searchParams.get("limit");

    let types: SearchType[] | undefined;
    if (typeParam) {
      const requested = typeParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean) as SearchType[];
      const valid = requested.filter((t) =>
        (SEARCH_TYPES as string[]).includes(t),
      );
      if (valid.length > 0) types = valid;
    }

    const limit = limitParam ? Number(limitParam) : undefined;

    const result = await searchAll(q, { types, limit });
    return success(result);
  } catch (err) {
    return error(err);
  }
}
