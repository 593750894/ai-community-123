# AI Community 功能实现计划书

> 基于 2026-06-02 UI/后端审计结果。原则：按"依赖链 + 业务价值"分阶段交付，每阶段必须过验收门才能进入下一阶段。

---

## 一、总览

### 当前状态
- 核心域可用：注册登录、频道浏览、发帖、评论、私信（一对一）、作品列表、合作发布、Admin 增删。
- 缺口集中在三类：
  1. **后端模型已就绪但前端 0 实现**：Notification（11 种类型）、Report（7 种 target）、AuditLog、ChannelMember 加入退出、Comment.likeCount/parentId。
  2. **前端 UI 占位但无后端**：顶部搜索、Bell 通知、Feed Tab 切换、关注/粉丝、首页 DEMO_WORKS、文件上传（仅收 URL）。
  3. **完全缺失**：Follow 模型、/me 个人中心、/c/* /t/* /u/* 路由、商业化层、Organization、群聊。

### 排期假设
- 单人全栈节奏，每个工作日 ~6h 净编码。
- 估时为前端 + 后端 + Prisma migration + 测试的总和，不含 Code Review/PR 等待。

### 执行约定（沿用项目分阶段开发规则）
- 一个阶段 = 一个 PR，按 `schema → server action/API → 前端组件 → 集成测试` 顺序。
- 每阶段交付前回答三个问题：能开起来吗？golden path 跑通吗？过去能用的没坏吗？
- 验收门未过不开下一阶段。验收脚本写在 PR 描述里。

---

## 二、阶段路线图

### 阶段 0 · 死链清理与路由前缀决策（1 天）

**目标**：把侧栏 19 个死链一次性收敛，避免后续阶段不断回炉。

**任务**
- 决策：保留 `/community/[channelId]` 还是新增 `/c/[slug]` 别名。建议**保留现有**，删 sidebar 里 `/c/` `/t/` 写死列表，改为从 DB 读出热门频道/标签（[src/components/layout/sidebar.tsx:66-87](src/components/layout/sidebar.tsx#L66-L87)）。
- 死链清单（先全部指向 `/community` 或加 `aria-disabled`，后续阶段补齐）：
  - `/me/works` `/me/likes` `/me/bookmarks` `/me/history`（阶段 7 实现）
  - `/settings`（阶段 9 实现）
  - `/community/creator-program` `/community/rules` `/about` `/legal/terms` `/legal/privacy` `/contact`（阶段 6 实现 rules，其他做静态页）
  - `/community/leaderboard` `/u/[handle]`（阶段 2/7 实现）
- 删除已确认无用的 mock：`right-panel.tsx` 里 `HOT_CREATORS` `TRENDING_TAGS` `EVENTS`，统一改用 DB 数据，留空白 fallback。

**验收门**
- 全站 lint 0 死链：用 Playwright/手动点完一遍 sidebar/navbar/right-panel，无 404。
- `pnpm build` 通过。

---

### 阶段 1 · 通知系统（4 天）

**目标**：让所有"反馈型"交互（点赞、评论、被回复、被关注、被 @、私信、合作申请）产生通知，用户能看到、能标已读。

**前置**：无（Notification 模型已就绪 [prisma/schema.prisma:561-580](prisma/schema.prisma#L561-L580)）。

**任务**
1. **后端触发层**（新增 `src/lib/notifications/emit.ts`）：
   - 提供 `emitNotification({ userId, type, ... })` 统一入口。
   - 在 likes/comments/messages 现有 Server Action 末尾调用。注意去重（同 actor 同 target 24h 内不重发）+ 自己操作自己不通知。
2. **API**：
   - `GET /api/notifications?cursor=...` 分页拉取。
   - `POST /api/notifications/[id]/read` + `POST /api/notifications/read-all`。
   - `GET /api/notifications/unread-count`（供 Bell badge 轮询）。
3. **前端**：
   - `<Bell>` 加 `Link` 到 `/notifications` + 未读 badge（每 60s 轮询 `unread-count`）[src/components/layout/navbar.tsx:117-125](src/components/layout/navbar.tsx#L117-L125)。
   - 新建 `/notifications` 列表页：分组（今天/本周/更早）、按类型图标、点击跳目标、自动 mark-read。
   - 用户首选项放阶段 9（/settings 时再做）。

**验收门**
- 用 A 账号给 B 账号点赞/评论/私信，B 的 Bell 上 badge 在 60s 内变化。
- B 进 `/notifications` 可看到三条记录，点击任一条跳目标且变已读。
- 自己点自己/重复操作不产生新通知。
- 通知数 > 100 时分页正常。

---

### 阶段 2 · 关注体系（3 天）

**目标**：用户能互关，首页"关注" Tab 能用，profile 能看到粉丝/关注。

**前置**：阶段 1（关注产生通知）。

**任务**
1. **Schema**：新增 `Follow` 模型 `{ id, followerId, followingId, createdAt }`，复合唯一 `(followerId, followingId)`。`User` 加 `followers`/`following` 关系。
2. **API**：
   - `POST /api/follows/toggle`（body: `{ userId }`，登录态必填）。
   - `GET /api/users/[id]/followers` `GET /api/users/[id]/following`（分页）。
3. **前端**：
   - `<FollowButton>` 组件，处理 optimistic + 未登录跳 login。
   - profile 页加 followers/following 计数 + 列表入口 [src/app/profile/[userId]/page.tsx:138-141](src/app/profile/[userId]/page.tsx#L138-L141)。
   - `right-panel.tsx` `HOT_CREATORS` 关注按钮接通。
   - 首页"关注" Tab 查询：当前用户 following 的人发的 post，按时间倒序。

**验收门**
- A 关注 B，B 通知 + B profile 粉丝 +1。
- A 取关 B，立刻反映。
- 首页"关注" Tab 仅显示已关注用户的帖子。
- 未登录点击"关注"跳登录页，登录后回到原页且自动完成关注。

---

### 阶段 3 · 全局搜索（3 天）

**目标**：顶部搜索框真正可用，输出跨 Post/Work/User/Channel/Tool 的统一结果页。

**任务**
1. **后端**：
   - `src/lib/search/index.ts` 提供 `searchAll(q, { types, limit })`。
   - 使用 Postgres `ILIKE` + `to_tsvector` GIN 索引（建议 migration 加索引：`Post(title)` `Post(content)` `Work(title)` `User(name)` `User(username)` `Tool(name)` `Channel(name)`）。
   - `GET /api/search?q=...&type=...`。
2. **前端**：
   - Navbar 搜索框 wrap `<form>` onSubmit 跳 `/search?q=...` [src/components/layout/navbar.tsx:95-105](src/components/layout/navbar.tsx#L95-L105)。
   - 全局 `/` 快捷键 focus 搜索（注意 input/textarea 焦点时跳过）。
   - `/search` 页：左侧类型 Tabs + 右侧结果列表 + 关键词高亮。

**验收门**
- 顶部输入 + Enter 跳 `/search?q=xxx` 并展示结果。
- `/` 键能 focus，在输入框里按 `/` 不会触发。
- 跨类型搜索结果 ≤200ms（本地 ≤1000 条数据）。
- 无结果时友好提示。

---

### 阶段 4 · 文件上传（4 天）

**目标**：作品/帖子/合作发布表单能真正上传图片和短视频，而不是粘 URL。

**决策点**（开工前必须确认）：
- 存储方案：Vercel Blob / Cloudflare R2 / S3 / 本地。建议 **R2**（成本 + 无 egress 费）。
- 文件大小上限：图片 10MB、视频 100MB（MVP）。
- 视频处理：MVP 不转码，仅校验格式 + 限大小。

**任务**
1. **后端**：
   - `POST /api/uploads/sign`：返回预签名 PUT URL + 公开访问 URL。鉴权 + rate limit。
   - `src/lib/uploads/client.ts`：浏览器上传封装（含进度回调）。
2. **前端**：
   - `<MediaUploader>` 组件：拖拽 + 点击 + 进度条 + 多文件 + 错误重试。
   - 接入 `create-post-form.tsx` / `create-work-form.tsx` / `create-collaboration-form.tsx`：取代 `videoUrl`/`thumbnailUrl`/`imageUrl` 的 URL input。
   - 已存的旧 URL 字段保留兼容（编辑场景 fallback）。
3. **存储域名**：环境变量 + Next.js `images.remotePatterns`。

**验收门**
- 表单选图后 30s 内完成上传，进度条到 100%。
- 拒绝超大文件、错误 MIME 时友好提示。
- 上传后立即在表单预览，提交后帖子页能展示。
- 已有的"粘 URL"老帖照常显示，不破坏既有数据。

---

### 阶段 5 · 评论增强 + 举报系统（3 天）

**目标**：评论支持回复+点赞，全站任何内容可举报，管理员能处理。

**前置**：阶段 1（举报触发通知给管理员）。

**任务**
1. **评论嵌套**：
   - 现有 `Comment.parentId` 已支持。`CommentList` 改为递归渲染，深度 ≤3 层（再深就 flat 显示）。
   - 加"回复"按钮 + Reply Composer。
   - 评论点赞：复用现有 likes 模式，写 `Comment.likeCount` 计数。
2. **举报**：
   - `<ReportButton>` 组件，挂到 PostCard / WorkCard / CollaborationCard / CommentList / 用户主页。
   - `POST /api/reports`：写 Report + 给所有 Admin 发通知。
   - Admin `/admin/reports` 页：列表（过滤状态/类型）+ 处理动作（驳回 / 删除目标 / 封号 → 走阶段 9 的能力）。

**验收门**
- 评论可三层嵌套，超过 3 层 flat。
- 评论点赞计数实时更新。
- 任意内容举报后，Admin 通知 +1，`/admin/reports` 列表新增一条。
- Admin 操作产生 AuditLog（阶段 9 验收时一并核对）。

---

### 阶段 6 · 频道成员 + 静态页（2 天）

**目标**：用户能加入/退出频道，成员数真实；新手引导跳转的 `/community/rules` 等页存在。

**任务**
1. **频道成员**：
   - `ChannelMember` 模型已就绪。
   - `POST /api/channels/[id]/members/toggle`。
   - `ChannelHeader` 加 `<JoinChannelButton>`：未加入显"加入"，已加入显"已加入"（hover 变"退出"）。
   - `_count.members` 改为真实计数。
2. **静态页**（MDX 或纯 React）：
   - `/community/rules` `/community/creator-program` `/about` `/legal/terms` `/legal/privacy` `/contact`。
   - 内容初稿可由产品/运营提供，工程做版式 + 路由。

**验收门**
- 加入/退出频道按钮即时反馈，成员数前后端一致。
- 新手引导卡 6 个链接全部 200。

---

### 阶段 7 · /me 个人中心 + Profile 整合（3 天）

**目标**：侧栏"我的"四项可用；统一用户主页 URL。

**任务**
1. **决策**：用 `/u/[username]` 还是继续 `/profile/[userId]`？建议**保留 `/profile/[userId]` 并加 `/u/[username]` rewrite 别名**（更友好的 URL）。
2. **页面**：
   - `/me`（dashboard：最近作品/帖子/收藏概览）
   - `/me/works`：我的全部作品（带筛选）
   - `/me/likes`：我点赞过的 Post + Work
   - `/me/bookmarks`：我收藏的 Post + Work
   - `/me/history`：浏览历史（需新加 `PostView` / `WorkView` 模型 + 写入逻辑；如果不做，把"浏览历史"从侧栏删掉）。
3. **未登录态**：全部跳 `/auth/login?next=/me/...`。

**验收门**
- 4 个 me 子页面都能渲染当前用户数据。
- 未登录访问跳登录，登录后回到原页。
- /u/[username] 能正确解析到对应 profile。

---

### 阶段 8 · 首页 Feed Tabs + 工具评分（4 天）

**目标**：首页 8 个 Tab 真实切换，DEMO_WORKS 退役；工具有评分和评论。

**任务**
1. **Feed Tabs** [src/app/page.tsx:127-138](src/app/page.tsx#L127-L138)：
   - 用 URL `?tab=recommend|following|latest|...` 维持状态（SSR 友好）。
   - 推荐：临时用"最近 7 天高互动" 后续接推荐引擎。
   - 关注：阶段 2 的 following feed。
   - 最新：按 createdAt desc。
   - 4 个标签 Tab：按 Post/Work 的 `tags` 字段筛选。
2. **DEMO_WORKS 退役**：[src/components/feed/work-card.tsx:203-296](src/components/feed/work-card.tsx#L203-L296) 删除写死数组，首页改读 DB。
3. **工具评分**：
   - Schema：新增 `ToolRating { id, toolId, userId, stars, comment, createdAt }`，唯一 `(toolId, userId)`。Tool 加 `avgRating Float?` 和 `ratingCount Int @default(0)`，写入时维护。
   - 前端：ToolCard 加平均分 + 评分人数；工具详情页加评分组件 + 评论列表。

**验收门**
- 首页 Tab 切换走 URL，刷新保留状态。
- DEMO_WORKS 在代码里搜不到。
- 工具评分提交后立即反映，同一用户改分而不是重复。

---

### 阶段 9 · Admin 增强 + AuditLog + 设置页（3 天）

**目标**：把 Admin 的 "MVP 只读" 注释全部拆掉；用户能改自己的设置。

**任务**
1. **用户管理**：
   - 改角色（USER/MOD/ADMIN）、改状态（ACTIVE/SUSPENDED/BANNED）、强制踏出登录态。
   - 所有动作写入 AuditLog（actorId, action, targetType, targetId, before/after）。
2. **帖子置顶/锁帖**：post 详情页 Admin 视角加按钮 → 触发 server action。
3. **工具编辑**：取代"删了重建"。
4. **`/admin/audit-logs`**：列表 + 筛选（actor/target/action/日期）。
5. **`/settings`**：账号（改邮箱/密码、注销）+ 通知偏好（开关每类 NotificationType）+ 隐私（profile 是否公开）。

**验收门**
- Admin 操作必有 AuditLog；查看页可还原"谁在何时做了什么"。
- 用户在 /settings 关闭"被关注通知"后，关注事件不再生成通知。
- 改密码后旧 session 失效。

---

### 阶段 10 · 商业化（单独立项 · 8-12 天）

**说明**：依赖支付渠道决策（Stripe / 微信支付 / 支付宝），先做产品需求文档再排期。

**最小范围**
- WorkflowItem 商品页 + 下架/上架。
- MembershipPlan 列表 + 订阅。
- Order 列表（用户视角 + Admin 视角）+ 退款。
- 创作者计划：分成规则 + 收益面板。

---

### 阶段 11 · Organization（单独立项 · 5-7 天）

**说明**：企业账号 + 成员管理 + 企业认证。等单用户 + 商业化稳定后开。

---

### 阶段 12 · 群聊 + 消息附件（单独立项 · 5-7 天）

**说明**：
- Conversation 群聊（schema 已支持多人参与）。
- Message 加 attachments 字段，复用阶段 4 的上传管道。
- 实时性：先加 SSE（阶段 1 通知系统同款架构），后续视量上 WebSocket。

---

## 三、风险与决策点（开工前必须定）

| 决策点 | 阶段 | 选项 | 默认建议 |
|---|---|---|---|
| 文件存储 | 4 | Vercel Blob / R2 / S3 / 本地 | R2 |
| 通知实时性 | 1 | 60s 轮询 / SSE / WebSocket | 先 60s 轮询，量上来改 SSE |
| URL 别名 | 7 | `/u/[username]` / 只用 `/profile/[id]` | 双跑 + rewrite |
| 推荐算法 | 8 | 时间衰减热度 / ML / 简单规则 | 阶段 8 用"最近 7 天高互动"，后续单独立项 |
| 支付渠道 | 10 | Stripe / 微信 / 支付宝 | 看目标市场，开工前确认 |

---

## 四、执行节奏

- **第 1-2 周**（阶段 0-3）：清理 + 通知 + 关注 + 搜索 → 用户基础体验闭环。
- **第 3 周**（阶段 4-5）：上传 + 评论/举报 → 内容生产闭环。
- **第 4 周**（阶段 6-8）：频道成员 + /me + Feed/工具 → 用户留存闭环。
- **第 5 周**（阶段 9）：Admin + 设置 → 运营闭环。
- **第 6 周起**：单独立项的商业化 / 组织 / 群聊。

总计约 25-30 个工作日完成阶段 0-9。阶段 10-12 视优先级再排。
