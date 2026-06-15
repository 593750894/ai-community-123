import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import {
  AppError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "@/lib/errors";
import { createRateLimiter } from "@/lib/rate-limit";

/**
 * Stage 16.5：付费下载签名 URL。
 *
 * 现状：workflow_items.download_url 是卖家上架时贴的「裸 URL」（多为 R2 / COS / 网盘
 * 的公开链接），checkout 页 PAID 状态下直接以 <a href> 形态吐到 HTML。
 *
 * 这导致三类已知风险：
 *   1. **永久泄漏**：URL 一旦出现在 HTML / browser history / 截图分享，任何人终身可下载，与是否登录无关。
 *   2. **退款不撤销访问**：买家拿到 URL → 申请 refund 后 URL 仍然可用 → 卖家两头亏。
 *   3. **无审计**：拉了多少次 / 谁拉的 / 何时拉的，全部黑盒。
 *
 * 本模块的解法：
 *   - 客户端不再持有裸 URL。改为：
 *       1) `POST /api/orders/{orderNo}/download-url` → 返回 `{ url: /api/orders/{orderNo}/download?t=<HMAC token>, expiresAt }`。
 *          该 endpoint 走 session 鉴权 + 调 `assertDownloadable` 重新校验「PAID + refundCents=0」。
 *       2) `GET /api/orders/{orderNo}/download?t=...` → verify HMAC（包括 token 与 URL 中 orderNo 的绑定）
 *          → 再次 `assertDownloadable`（refund 中途发生可在此撤销）→ 写一行 DownloadGrant → 302 到裸 URL。
 *   - Token = `v1.<bodyB64u>.<sigB64u>`，body = JSON `{o,u,e,n,i}`（订单号 / 用户 / exp / nonce / iat）。
 *     签名串覆盖 `v1.<bodyB64u>`，所以改字段需要密钥重签。HMAC key 复用 env.AUTH_SECRET_KEY。
 *
 * 残留威胁（明知不全解，留给后续 P1 真正切「服务端代签云存储 URL」）：
 *   - 一旦 302 到裸 URL，浏览器 / 下载器从此持有该裸 URL，可以裸链分享。这与现状等价 — 本期 P0 不解决。
 *   - 实际防止「Token 被 XSS 截走拿来下载」靠两条：① TTL 5min，② token.u 与 redeem 时的 order.userId 强绑定
 *     （token.u !== order.userId 直接 401）。退款 / 订单状态变更也会让 token 立刻失效。
 *
 * 关键不变量：
 *   - 任何 redeem 都必须重新 SELECT 一次 order + workflowItem，绝不缓存 token 内的状态字段。
 *   - 仅 `status = PAID && refundCents = 0` 视为可下载（部分退款也撤销访问；不希望出现「我退了一半还能继续拿」）。
 *   - signing key 与 AUTH_SECRET 共用；轮换 AUTH_SECRET 时旧 token 自动失效（5min 内 worst case 让用户重发一次请求）。
 */

const TOKEN_VERSION = "v1";
/** Token 默认 TTL：5 分钟。短到能极大压缩泄漏窗口；长到足够移动端从「点按钮」到「拉取流」。 */
export const DOWNLOAD_TOKEN_TTL_MS = 5 * 60 * 1000;

/** Mint：每用户每分钟最多 30 次，防止暴力轮转 / 探测。 */
const mintLimiter = createRateLimiter({
  name: "download-url 签发",
  limit: 30,
  windowMs: 60_000,
});

/** Redeem：每 (orderNo, ip) 每分钟最多 60 次，防爬下载链接。 */
const redeemLimiter = createRateLimiter({
  name: "download 兑换",
  limit: 60,
  windowMs: 60_000,
});

export function checkMintRateLimit(userId: string): void {
  mintLimiter.check(userId);
}

export function checkRedeemRateLimit(orderNo: string, ip: string): void {
  // ip 可能为空（开发环境 / 自定义部署）。空时退化为按 orderNo 限流，仍然够用。
  redeemLimiter.check(`${orderNo}|${ip || "anonymous"}`);
}

// ────────────────────────── Token 编解码 ──────────────────────────

interface TokenBody {
  /** orderNo（与 URL path 中的 orderNo 必须一致） */
  o: string;
  /** userId（buyer.id；必须与 order.userId 一致） */
  u: string;
  /** issuedAt epoch 秒 */
  i: number;
  /** expiresAt epoch 秒 */
  e: number;
  /** 128bit nonce（base64url） */
  n: string;
}

function b64urlEncode(buf: Buffer | string): string {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf, "utf8");
  return b
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function b64urlDecode(s: string): Buffer {
  // 长度补齐到 4 的倍数
  const padded = s + "=".repeat((4 - (s.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function hmacSign(payload: string): Buffer {
  return createHmac("sha256", env.AUTH_SECRET_KEY).update(payload).digest();
}

export interface SignDownloadTokenInput {
  orderNo: string;
  userId: string;
  /** 可覆盖 TTL（仅用于测试 / 特殊路径）；默认 5min。 */
  ttlMs?: number;
  /** 注入「当前时间」便于测试。 */
  now?: Date;
}

export interface SignedDownloadToken {
  token: string;
  /** ISO8601 字符串，方便客户端按本地时区展示倒计时。 */
  expiresAt: string;
  /** 客户端拼好的相对路径 URL。 */
  url: string;
}

export function signDownloadToken(input: SignDownloadTokenInput): SignedDownloadToken {
  const now = input.now ?? new Date();
  const ttlMs = input.ttlMs ?? DOWNLOAD_TOKEN_TTL_MS;
  const exp = new Date(now.getTime() + ttlMs);
  const body: TokenBody = {
    o: input.orderNo,
    u: input.userId,
    i: Math.floor(now.getTime() / 1000),
    e: Math.floor(exp.getTime() / 1000),
    n: b64urlEncode(randomBytes(16)),
  };
  const bodyB64 = b64urlEncode(JSON.stringify(body));
  const signingPayload = `${TOKEN_VERSION}.${bodyB64}`;
  const sigB64 = b64urlEncode(hmacSign(signingPayload));
  const token = `${TOKEN_VERSION}.${bodyB64}.${sigB64}`;
  return {
    token,
    expiresAt: exp.toISOString(),
    url: `/api/orders/${input.orderNo}/download?t=${encodeURIComponent(token)}`,
  };
}

export interface VerifiedDownloadToken {
  orderNo: string;
  userId: string;
  nonce: string;
  issuedAt: Date;
  expiresAt: Date;
}

/**
 * 验证 token 的密码学有效性（签名 + 版本 + 时效）。
 *
 * 注意：这里**只做无状态校验**。订单状态 / 持有人匹配交给 assertDownloadable 在 DB 端兜底，
 * 这样 token 与「数据库当前状态」之间不会产生缓存窗口。
 */
export function verifyDownloadToken(
  raw: string | null | undefined,
  now: Date = new Date(),
): VerifiedDownloadToken {
  if (!raw || typeof raw !== "string") {
    throw new UnauthorizedError("下载链接缺少凭据");
  }
  const parts = raw.split(".");
  if (parts.length !== 3) {
    throw new UnauthorizedError("下载链接格式不正确");
  }
  const [ver, bodyB64, sigB64] = parts;
  if (ver !== TOKEN_VERSION) {
    throw new UnauthorizedError("下载链接版本不被支持");
  }
  const expectedSig = hmacSign(`${ver}.${bodyB64}`);
  let providedSig: Buffer;
  try {
    providedSig = b64urlDecode(sigB64);
  } catch {
    throw new UnauthorizedError("下载链接签名格式不正确");
  }
  if (
    providedSig.length !== expectedSig.length ||
    !timingSafeEqual(providedSig, expectedSig)
  ) {
    throw new UnauthorizedError("下载链接签名校验失败");
  }
  let body: TokenBody;
  try {
    body = JSON.parse(b64urlDecode(bodyB64).toString("utf8")) as TokenBody;
  } catch {
    throw new UnauthorizedError("下载链接载荷不可解析");
  }
  if (
    typeof body.o !== "string" ||
    typeof body.u !== "string" ||
    typeof body.i !== "number" ||
    typeof body.e !== "number" ||
    typeof body.n !== "string"
  ) {
    throw new UnauthorizedError("下载链接载荷字段缺失");
  }
  const expMs = body.e * 1000;
  if (expMs <= now.getTime()) {
    throw new UnauthorizedError("下载链接已过期，请刷新页面重新生成");
  }
  // i 在未来 → 一定是被篡改 / 时钟错乱，拒绝。容忍 60s 时钟漂移。
  if (body.i * 1000 - now.getTime() > 60_000) {
    throw new UnauthorizedError("下载链接签发时间异常");
  }
  return {
    orderNo: body.o,
    userId: body.u,
    nonce: body.n,
    issuedAt: new Date(body.i * 1000),
    expiresAt: new Date(expMs),
  };
}

// ────────────────────────── 业务层校验 ──────────────────────────

export interface DownloadableOrder {
  orderId: string;
  orderNo: string;
  buyerId: string;
  workflowItemId: string;
  /** 卖家上架时填的裸 URL；redeem 时 302 到这里。 */
  rawDownloadUrl: string;
}

/**
 * 「订单可下载」校验：从 DB 读最新状态，封装四层防线：
 *   1. 订单存在 → NotFound
 *   2. 持有人匹配 → 用 NotFound 屏蔽订单存在性（与 getOrderByNo 同款防枚举）
 *   3. PAID 且 refundCents=0 → 否则 ForbiddenError
 *   4. workflowItem 上有 downloadUrl → 否则 NotFound（卖家还没上传文件）
 *
 * **必须由 mint + redeem 两个入口都调用一次**，不能省。原因：
 *   - mint 时合法的订单，可能在 5min token 有效期内被退款 → redeem 那一刻必须重新校验。
 *   - token 内的 userId 校验是密码学层的，refund 状态校验是业务层的，两层不可相互替代。
 */
export async function assertDownloadable(
  orderNo: string,
  expectedBuyerId: string,
): Promise<DownloadableOrder> {
  const order = await prisma.order.findUnique({
    where: { orderNo },
    select: {
      id: true,
      orderNo: true,
      userId: true,
      status: true,
      type: true,
      refundCents: true,
      workflowItemId: true,
      workflowItem: {
        select: { id: true, downloadUrl: true },
      },
    },
  });
  // (1) (2) NotFound：不暴露是否存在。
  if (!order) throw new NotFoundError("订单");
  if (order.userId !== expectedBuyerId) throw new NotFoundError("订单");
  // 该订单类型必须是工作流购买；MEMBERSHIP 等不走下载分发。
  if (order.type !== "WORKFLOW_PURCHASE" || !order.workflowItemId || !order.workflowItem) {
    throw new ValidationError("该订单类型不支持下载");
  }
  // (3) 状态：PAID + 0 退款。部分退款 / FULL refund 都立即撤销下载权。
  if (order.status !== "PAID") {
    throw new ForbiddenError(
      order.status === "PENDING"
        ? "订单尚未支付，无法下载"
        : "该订单当前状态不可下载",
    );
  }
  if (order.refundCents > 0) {
    throw new ForbiddenError("订单已申请退款，下载权限已撤销");
  }
  // (4) 文件就绪
  if (!order.workflowItem.downloadUrl) {
    throw new NotFoundError("下载文件");
  }
  // (5) 协议白名单 — 防 javascript: / data: / file: 等被恶意卖家写入 download_url 后通过
  // 302 Location 触发 XSS。现代浏览器多数会拒绝 Location: javascript:，但不可依赖；这里硬拒。
  if (!isSafeDownloadProtocol(order.workflowItem.downloadUrl)) {
    throw new ValidationError("下载链接协议不被支持");
  }
  return {
    orderId: order.id,
    orderNo: order.orderNo,
    buyerId: order.userId,
    workflowItemId: order.workflowItem.id,
    rawDownloadUrl: order.workflowItem.downloadUrl,
  };
}

/**
 * 仅放行 http(s)。注意 zod `.url()` 接受 `javascript:` / `data:` 等任意 RFC URL，
 * 卖家上架时不会被业务层拒掉；本检查在 redeem 末端兜底，确保 Location 头不会变成 XSS payload。
 */
export function isSafeDownloadProtocol(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// ────────────────────────── 审计 ──────────────────────────

export interface RecordGrantInput {
  orderId: string;
  userId: string;
  token: VerifiedDownloadToken;
  ip: string | null;
  userAgent: string | null;
}

const IP_MAX = 64; // 防御长 header 注入
const UA_HASH_LEN = 16; // 32 hex chars

export function hashUserAgent(ua: string | null): string | null {
  if (!ua) return null;
  return createHash("sha256").update(ua).digest("hex").slice(0, UA_HASH_LEN * 2);
}

/**
 * 写一行 grant 记录。失败不抛 — 审计漏一条不应阻断用户下载，只在控制台打印。
 * 调用方应在 302 之前 await 这个调用。
 */
export async function recordDownloadGrant(input: RecordGrantInput): Promise<void> {
  try {
    await prisma.downloadGrant.create({
      data: {
        orderId: input.orderId,
        userId: input.userId,
        tokenNonce: input.token.nonce,
        issuedAt: input.token.issuedAt,
        expiresAt: input.token.expiresAt,
        ip: input.ip ? input.ip.slice(0, IP_MAX) : null,
        userAgentHash: hashUserAgent(input.userAgent),
      },
    });
  } catch (err) {
    // 不冒泡：审计失败让 redeem 继续，但日志保留以便排查 schema / 连接问题。
    console.error("[download] failed to record grant", err);
  }
}

// ────────────────────────── HTTP 工具 ──────────────────────────

/**
 * 从请求头解析客户端 IP。生产部署应当通过反向代理设置 x-forwarded-for（最左为最初客户端），
 * 否则退化到 x-real-ip / 空。我们只取第一个并截短，避免被恶意 header 撑爆库表。
 */
export function extractClientIp(headers: Headers): string | null {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip") ?? null;
}

/**
 * 给 AppError 提供一个共用的 throw helper — 让路由层只关心「拿到结果」即可。
 * 已通过 errors.ts 的类型层级，调用方用 instanceof AppError 即可识别。
 */
export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
