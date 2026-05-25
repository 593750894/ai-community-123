import type { ApiError, ApiSuccess } from "@/types/api";

import { AppError } from "./errors";

export function success<T>(data: T, message?: string, status = 200): Response {
  const body: ApiSuccess<T> = message
    ? { success: true, data, message }
    : { success: true, data };
  return Response.json(body, { status });
}

export function created<T>(data: T, message?: string): Response {
  return success(data, message, 201);
}

export function error(err: unknown): Response {
  if (err instanceof AppError) {
    const body: ApiError = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details != null ? { details: err.details } : {}),
      },
    };
    return Response.json(body, { status: err.statusCode });
  }

  const body: ApiError = {
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message:
        process.env.NODE_ENV === "development" && err instanceof Error
          ? err.message
          : "服务器内部错误",
    },
  };
  return Response.json(body, { status: 500 });
}
