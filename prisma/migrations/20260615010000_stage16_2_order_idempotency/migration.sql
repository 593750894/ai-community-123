-- Stage 16.2：订单客户端幂等键
--
-- 解决问题：用户双击「立即支付」、网络重试、浏览器导航回填表单 → POST /api/orders
-- 触发两次 → 生成两笔互相独立的 PENDING 订单。当前 rate-limit (10/min) 不阻挡
-- 同秒并发；useTransition 的按钮 disabled 只防同一 React 实例。
--
-- 设计：客户端在「购买意图」生成时创建唯一 nonce，整条 intent 生命周期复用同一 nonce
-- （刷新 / 重新打开 → 新 nonce → 新订单意图）。createOrder 命中既有 nonce 直接返回
-- 原订单的 paymentUrl，不再调 PSP / 不再建行。
--
-- 复合唯一 (user_id, client_nonce)：
-- - 限定 per-user 避免跨用户 nonce 探测 / 冲突攻击。
-- - NULL 不参与约束（Postgres UNIQUE 把 NULL 视为彼此不等），旧无 nonce 路径不受影响。
--
-- 历史数据：所有 historical orders.client_nonce 默认 NULL，不参与约束，不需 backfill。

ALTER TABLE "orders" ADD COLUMN "client_nonce" TEXT;

CREATE UNIQUE INDEX "orders_user_id_client_nonce_key"
  ON "orders" ("user_id", "client_nonce");
