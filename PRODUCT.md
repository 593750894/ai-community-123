# Product

## Register

product

## Users

AI 视频创作者 —— 主要使用 Kling、ComfyUI、Suno、Seedance 这类工具做漫剧 / 短剧 / 数字人 / 电商广告等视频。来 SeedLand 的三个核心场景：

1. **发布成片**（showcase + works）—— 让同行看到自己的作品
2. **找合作**（collaboration）—— 拼团接项目、找剪辑、找写手、招联合创始人
3. **看同行作品和工作流**（community feed）—— 吸收 prompt / 调参 / 后期经验

他们在创作时是孤独的，在 SeedLand 时是社交的。次要用户：工具 / 工作流玩家、品牌 / 工作室团队（已有 organizations 模块支撑）。

## Product Purpose

为 AI 视频创作者建立一个**长期专业身份**与**协作网络**。三件事必须做到位：

1. **作品是主角** —— showcase / feed 卡片让 4K 缩略图、电影感构图、运动光被看见，而不是被 UI chrome 压住
2. **合作发起摩擦最小** —— 从看到一个作品到发起协作请求 < 2 click
3. **信任靠真实** —— 企业认证 / 创作者档案 / 工作记录的 attribution 可视可信，不是 likes 的虚荣指标

成功 = 创作者把 SeedLand profile 当作品集首页用。下次别人问"你是谁"，他贴的是 `seedland.com/u/xxx` 不是 `bilibili.com/u/xxx`。

## Brand Personality

**高端 · 电影质感 · 手工精制。**

- **高端**：reading 像 The Browser Company / Vercel / Linear 那种节制，不打折促销不发奖牌，typography 见骨架，金色 / 高饱和警示色慎用
- **电影质感**：UI 默认暗、留 letterboxing 一样的呼吸感，hero 内容用 16:9 / 21:9 视频缩略图卡，预览有 subtle parallax / hover scrub
- **手工精制**：每个组件看得出 1–2px 的 optical adjust、阴影是有颜色的、过渡用 ease-out-expo 而非 linear；每一次 hover / active 都是被设计过的，不是 Tailwind 默认的 150ms 线性

**Voice**：客气而克制的中文，少 emoji、零感叹号、零"赋能 / 打造 / 全新升级 / 颠覆"类 AI tells。报错说"连接失败，请重试"，不说"哎呀出错了！"。

## Anti-references

明确不像：

- **抖音 / Bilibili / 快手** —— 不堆色 tag、不类别瀑布流推送、不满屏推荐位、不"为你推荐"的同质化流量分发
- **Salesforce / Notion / 企业 dashboard** —— 不灰冷冰冰、不数据表格主导 IA、不刷分进度条、不"任务待办"打卡感
- **Discord / Slack 夜间 playground** —— 不 emoji 化、不深夜 stripe 发光、不抖音化 GIF / 弹窗
- **Web3 / NFT marketplace** —— 不彩虹渐变、不玻璃珍珠、不"震动看股购买"、不 metaverse 包装

## Design Principles

1. **作品是 UI 主角，chrome 是配角** —— 所有 navbar / sidebar / right-panel 在作品场景只许做减法，不许做加法。任何让缩略图失色的装饰都得让位。
2. **手工精制的细节是和 Salesforce 区分开的护城河** —— 1–2px optical adjust、colored shadow、ease-out-expo 过渡是"非可选 polish"，而不是奢侈。
3. **专业身份高于网红身份** —— likes / followers 不当 KPI；作品集、合作记录、企业认证才是身份证。指标设计上压抑虚荣指标的视觉权重。
4. **沉默胜过喊话** —— voice 默认克制，UI 默认暗。需要强调时靠**对比度 / 留白 / 单一 accent** 跳出来，而非加色 / 加 emoji / 加感叹号。
5. **暗是基底，亮是工具** —— 默认 dark，light mode 是给咖啡店 / 露天 / OLED 烧屏担忧者的工具。dark 决定品牌印象，light 决定可达性。

## Accessibility & Inclusion

**基线：WCAG 2.1 AA** —— 正文 ≥4.5:1，大文本 ≥3:1，placeholder 同样 4.5:1（不准用淡灰偷工），focus ring 必现，键盘可达全套（已加 skip-link + role="menuitem"），`prefers-reduced-motion` 包裹所有动画。

**额外重点**：

- **色弱友好**：状态不仅依赖颜色（成功 / 失败 / 警告 配 icon 或文字标签），protanopia / deuteranopia 安全调色（避免红绿仅靠 hue 区分）
- **动画敏感**：`prefers-reduced-motion` 全量检查 —— 不止视觉装饰动画，包括 page-enter 序列、列表 stagger、scroll-driven reveal，统统降级为 instant 或 crossfade
- **文本可读性**：line-length 上限 65–75ch，大段中文 line-height ≥1.7
- **国际化**：中文为主，英文 fallback 不能裁掉变音符号或 East Asian Width 错位
