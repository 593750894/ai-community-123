import { headers } from "next/headers";

/**
 * 抽取审计日志需要的客户端元数据：IP + UA。
 *
 * - Vercel / 反向代理：用 x-forwarded-for 第一段；
 * - 没有上述头时退化到 x-real-ip / null（schema 允许 null）。
 * - UA 直接读 user-agent，没有就 null。
 *
 * 调用方在 Server Component / Server Action 上下文里调用即可（headers() 需要请求作用域）。
 */
export interface ClientMeta {
  ip: string | null;
  userAgent: string | null;
}

export async function getClientMeta(): Promise<ClientMeta> {
  try {
    const h = await headers();
    const xff = h.get("x-forwarded-for");
    const fwdIp = xff?.split(",")[0]?.trim() || null;
    const realIp = h.get("x-real-ip");
    const ip = fwdIp || realIp || null;
    const userAgent = h.get("user-agent") || null;
    return { ip, userAgent };
  } catch {
    return { ip: null, userAgent: null };
  }
}
