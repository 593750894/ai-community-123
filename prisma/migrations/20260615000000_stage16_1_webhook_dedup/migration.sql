-- Stage 16.1：支付 webhook 幂等表
--
-- 动机：当前 markOrderPaid 在订单层面通过 updateMany WHERE status=PENDING 做幂等，
-- 但 verifyWebhook（RSA / HMAC / AES-GCM 解密）会在每次 PSP 重发时都跑一遍，且没有
-- "我们到底收到过这条 webhook 吗" 的 ops 审计源。
--
-- 解决：在 webhook 路由 verify 通过、markOrderPaid 之前插入一行 (provider, provider_event_id)；
-- 复合唯一索引保证重发命中既有行 → 路由直接返回 200。
--
-- provider_event_id 由各 provider 提供：
--   MOCK         : `${orderNo}|${transactionId}|${paidAtISO}`
--   WECHAT_PAY   : v3 notification body.id
--   ALIPAY       : params.notify_id
--
-- raw_body_hash 仅作取证用，不参与去重。

CREATE TABLE "webhook_events" (
  "id"                TEXT      PRIMARY KEY,
  "provider"          TEXT      NOT NULL,
  "provider_event_id" TEXT      NOT NULL,
  "order_no"          TEXT,
  "event_type"        TEXT      NOT NULL,
  "raw_body_hash"     TEXT      NOT NULL,
  "received_at"       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at"      TIMESTAMP
);

CREATE UNIQUE INDEX "webhook_events_provider_provider_event_id_key"
  ON "webhook_events" ("provider", "provider_event_id");

CREATE INDEX "webhook_events_order_no_idx"
  ON "webhook_events" ("order_no");

CREATE INDEX "webhook_events_received_at_idx"
  ON "webhook_events" ("received_at");
