-- Stage 16.5：付费下载签名 URL — 审计 / 风控用的 grant 日志。
--
-- 动机：今天 workflow_items.download_url 通过 checkout 页面 <a href> 直接吐到 HTML，
-- 任何拿到该 URL 的人（截图分享 / browser history / refund 后的买家）都拥有终身访问权。
-- 改造方案：买家 → POST /api/orders/{orderNo}/download-url → 拿到 5min TTL 的 HMAC 签名 URL
-- → GET 该 URL 时重新校验 (status=PAID, refundCents=0) → 302 到真正的 download_url。
--
-- 本表只「记录每次成功 redeem」，便于事后排查滥用 / 风控。不参与签名验证本身（无状态 HMAC）。
--
-- 字段说明：
--   order_id        : 关联订单（CASCADE 删除）。
--   user_id         : 实际 redeem 的用户（token 里的 u 字段；与 order.user_id 一致才视为合法）。
--   token_nonce     : 签名 token 里的 n 字段（128bit）— 单 token 重复 redeem 会出现多行同 nonce，
--                     用于排查"同一 token 被多次播放"等异常。不做唯一索引（短 TTL 已限制重放量级）。
--   issued_at       : token 签发时的 iat（来自 token body，回填进表方便对比）。
--   expires_at      : token 的 exp。
--   redeemed_at     : 服务端实际 redeem 的时间（default now）。
--   ip              : 取自 x-forwarded-for / x-real-ip 的第一个 IP，截 64 字符防止超长头注入。
--   user_agent_hash : sha256(UA) 截 16 字节十六进制；记 hash 而非原文避免无意义 PII 堆积。
CREATE TABLE "download_grants" (
  "id"              TEXT      PRIMARY KEY,
  "order_id"        TEXT      NOT NULL,
  "user_id"         TEXT      NOT NULL,
  "token_nonce"     TEXT      NOT NULL,
  "issued_at"       TIMESTAMP NOT NULL,
  "expires_at"      TIMESTAMP NOT NULL,
  "redeemed_at"     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ip"              TEXT,
  "user_agent_hash" TEXT,

  CONSTRAINT "download_grants_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE,
  CONSTRAINT "download_grants_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX "download_grants_order_id_redeemed_at_idx"
  ON "download_grants" ("order_id", "redeemed_at" DESC);

CREATE INDEX "download_grants_user_id_redeemed_at_idx"
  ON "download_grants" ("user_id", "redeemed_at" DESC);
