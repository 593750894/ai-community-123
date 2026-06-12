import { getSession } from "@/lib/auth/session";
import { subscribe } from "@/lib/realtime/bus";

/**
 * Stage 12.5：Server-Sent Events 实时端点。
 *
 * 协议形态：
 *   GET /api/realtime/stream
 *     200 text/event-stream  → "event: <kind>\ndata: <json>\n\n"
 *     401 application/json   → 未登录 / session 被吊销
 *
 * 行为：
 *   - 鉴权：未登录直接 401（不要打开流，避免浏览器无限重连消耗资源）。
 *   - 订阅：注册到内存 bus，userId 维度；同一用户多 tab 多订阅独立维护。
 *   - 心跳：每 25s 写一个注释行 `: hb <ts>\n\n`，穿透 Nginx / Cloudflare 60s 空闲断开。
 *     同时每隔 HEARTBEAT_AUTHCHECK_EVERY 次心跳重新跑一次 getSession —— 让强制下线 /
 *     封禁 / 改密这类 admin 动作能在 ~2min 内中断已开的流（cleanup → client 看到 EOF
 *     → useRealtime 走指数退避重连 → 401 → 停下）。
 *   - 清理：client 断开 (request.signal abort) 或 controller 关闭时取消订阅 + 清心跳。
 *
 * 设计取舍：
 *   - 不发完整 payload，只推 conversationId/messageId 等指针，客户端按需 router.refresh。
 *     这样：① 不会泄漏 muted 用户不该看的内容；② 不需要在 SSE 端复算 permission；
 *     ③ 多源更新（SQL 写入 + R2 异步处理）也能保证客户端永远拿到最新视图。
 *   - 不实现 Last-Event-ID 补送：MVP 阶段失联后由下次轮询（Bell 60s）或用户重新进入页面补齐。
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEARTBEAT_INTERVAL_MS = 25_000;
// 每 5 次心跳（约 125 秒）做一次会话回查；getSession 在 DB 出错时会抛——抛到 setInterval
// 的 callback 里没法 reject 流，所以包 try/catch：DB 抖动期不主动断流（避免误杀正常用户）。
const HEARTBEAT_AUTHCHECK_EVERY = 5;

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: "UNAUTHORIZED", message: "请先登录" },
      }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const encoder = new TextEncoder();
  const userId = session.userId;

  // 复用同一个 cleanup 函数避免清理被重复执行 / 早退泄漏 timer。
  // 提升到 stream 外层，让 cancel() 也能直接调（不再复制 teardown）。
  let cleanedUp = false;
  let unsubscribe: (() => void) | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let heartbeatCount = 0;
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
  let abortHandler: (() => void) | null = null;

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (unsubscribe) {
      try {
        unsubscribe();
      } catch {
        // ignore
      }
      unsubscribe = null;
    }
    if (abortHandler) {
      try {
        request.signal.removeEventListener("abort", abortHandler);
      } catch {
        // ignore
      }
      abortHandler = null;
    }
    if (controllerRef) {
      try {
        controllerRef.close();
      } catch {
        // already closed
      }
      controllerRef = null;
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
      // 安全 enqueue：controller 关闭后再写会抛 TypeError —— 捕获后触发 cleanup。
      const safeEnqueue = (chunk: string): boolean => {
        try {
          controller.enqueue(encoder.encode(chunk));
          return true;
        } catch {
          cleanup();
          return false;
        }
      };

      // 1) 先发 retry 指令（断线后浏览器按 2s 重试，比默认 3s 快一点）+ 一次 ready 信号。
      //    用 SSE 注释行 `: xxx\n\n` 不占 event name，避免被客户端 event handler 误捕。
      safeEnqueue(`retry: 2000\n: ready ${Date.now()}\n\n`);

      // 2) 注册订阅：每个事件按 SSE 协议输出 event/data 两行 + 空行分隔。
      unsubscribe = subscribe(userId, (event) => {
        const payload = `event: ${event.kind}\ndata: ${JSON.stringify(event)}\n\n`;
        safeEnqueue(payload);
      });

      // 3) 心跳：每 25s 写注释行；写失败说明 stream 已关，主动 cleanup。
      //    每 N 次心跳重新跑一次 getSession —— session 被吊销 / 用户被封禁 / 改密
      //    都会让回查返回 null，主动断流；DB 抖动（getSession 抛异常）不主动断流。
      heartbeatTimer = setInterval(async () => {
        if (cleanedUp) return;
        if (!safeEnqueue(`: hb ${Date.now()}\n\n`)) return;
        heartbeatCount += 1;
        if (heartbeatCount % HEARTBEAT_AUTHCHECK_EVERY !== 0) return;
        try {
          const fresh = await getSession();
          if (cleanedUp) return;
          if (!fresh || fresh.userId !== userId) {
            cleanup();
          }
        } catch {
          // DB / cookies() 异常时不主动断流，下个周期再试。
        }
      }, HEARTBEAT_INTERVAL_MS);

      // 4) 客户端断开（关 tab / 切页 / 网络变化）通过 request.signal 通知。
      abortHandler = () => cleanup();
      if (request.signal.aborted) {
        cleanup();
      } else {
        request.signal.addEventListener("abort", abortHandler, { once: true });
      }
    },
    cancel() {
      // 当 Response body 被 consumer 取消（极少触发，但保底也要释放订阅）。
      // 走同一个 cleanup —— 不再复制 teardown 分支。
      cleanup();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // 显式禁用反向代理缓冲（Nginx / Cloudflare）—— 否则 SSE 会被攒成块延迟下发。
      "X-Accel-Buffering": "no",
    },
  });
}
