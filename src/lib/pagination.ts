import type { PaginatedData } from "@/types/api";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export function parsePagination(url: URL) {
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(url.searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE));
  const skip = (page - 1) * pageSize;
  return { page, pageSize, skip };
}

export function paginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedData<T> {
  const totalPages = Math.ceil(total / pageSize) || 1;
  return {
    items,
    total,
    page,
    pageSize,
    totalPages,
    hasMore: page < totalPages,
  };
}
