# AGENTS.md — 项目协作指南

## 设计约束（硬性）

- 已审批设计规范：`outputs/design/设计规范-design-spec.md`（G0 已通过）。实现期**零自由发挥**：布局、文案、配色、交互一律以规范与原型为准；任何变更需重新过审。
- 设计 tokens 与组件样式集中在 `src/styles.css`，组件内不得写死颜色/间距替代 token。
- 响应式断点：≥1024 桌面 / 768–1023 平板 / <768 移动（周看板降级为星期 Tab + 单日列表，月历压缩为日期 + 数量角标）。

## 数据语义（重要）

- `CONTENT_BLOCKLIST`（小课堂/发布会/预告/片花/花絮/幕后/访谈/见面会/先导/抢先看）**只影响最新集解析**，不参与周表过滤；周表按平台原始更新数据展示。
- 追番日历与「今日追番更新」默认**仅已追番**，可切换全部番剧。
- 下周排期预测：同步在清洗/豆瓣过滤后，对本周**未完结**条目按同星期同时段 +7 天生成「预计」排期（`predicted: true`，前端标「预计」）；已完结（大结局/结局点映/全X集/X集全）条目标记 `finished: true` 且不预测；预测条目不参与时长/豆瓣过滤，看板计数仅统计本周真实数据。
- 短剧过滤（前端开关）：同步**保留**全部已知时长条目（含 <300s 短条目）；前端「短剧过滤」默认开启、阈值默认 600s（10 分钟）可调（1/3/5/10/15 分钟，localStorage 键 `anime-calendar.shortfilter.v1`），关闭时展示全部；**过滤开关开启即隐藏**用户手动屏蔽的剧集（localStorage 键 `anime-calendar.blocked.v1`，卡片收藏按钮下方「屏蔽」按钮维护）与优酷名称含断句标点（、，。：；，不匹配 ？！以免误伤「是王者啊？第六季」等正剧）的条目；控件统计文案「已过滤 X 部」= 当前周真实条目（排除 predicted）中被过滤隐藏的去重剧部数（时长不足 + 手动屏蔽 + 优酷标点，与 `applyShortFilter` 判定一致），其中手动屏蔽单独标注；**追番日历（日程/周/月）不受短剧过滤影响**，按原始数据展示。
- 更新规则（`rule` 字段）：腾讯卡片底部原文；B站取季接口 `new_ep.desc`（如「连载中, 每周一、六 9:00更新」，去掉「连载中,」前缀）；优酷/爱奇艺按星期 Tab 排期推导「每周X更新」/「每日更新」（仅未完结剧，已完结不生成）。
- 腾讯更新时间：卡片底部规则文案按「星期匹配」解析——SVIP 抢先日取 SVIP 时间（如周一 18:00），VIP 常规日取 VIP 时间（如周二 10:00），避免用错档期。
- 总集数（`total` 字段）：B站 season API `total`（缺省回退已更新集数）、优酷 show_page `episodeTotal`、爱奇艺 avlistinfo `data.total`；腾讯仅「全N集」文案（连载中剧集平台未公开计划总集数，不做推断）。前端 `formatTotal` 按平台单位展示「共N集/话」。
- 优酷直达链接：卡片 URL 一律用 `show_page/id_{showId}.html`（浏览器会落到该动漫播放页）；`previewInfo.videoId` 是预览短片（片花/预告）**不可**作为直达链接。
- 时长富集：B站季分集接口 `api.bilibili.com/pgc/view/web/season?season_id=`（毫秒，按 episode_id 匹配、正片最新集兜底）；腾讯分集接口 `pbaccess.video.qq.com/.../GetPageData`（`vsite_episode_list`，每集秒级 duration，按集数匹配、非花絮最新集兜底）；优酷 show_page 内联时长（秒/ISO 8601）优先 + 播放页 `pageMap.extra.duration` 兜底，连续请求触发 `_____tmd_____/punish` 反爬时按「慢速 1.2s + 挑战页冷却重试 + 挑战页带出真实 videoId 转播放页 + Playwright 浏览器兜底」降级；爱奇艺专辑分集接口 `pcw-api.iqiyi.com/albums/album/avlistinfo?aid=`（按集数匹配、最新集兜底）。
- 内容类型排除：标题含「动态漫/AI动漫/泡面番」（AI 生成短剧）的条目在同步时直接丢弃并记入 `warnings`（与时长无关）；爱奇艺另以评论区「AI 关键字 + 负面情绪」启发式过滤（限流时优雅降级）；优酷/爱奇艺「时长缺失或 <1 分钟」条目追加豆瓣影视搜索甄别——精确命中且「暂无评分」丢弃（白名单保护正剧，如苏东坡与杭州的故事），未命中/查询失败保留，每次同步查询上限 10 次、间隔 2s（反爬约束，`scripts/douban.mjs`）；用户经评论区等渠道确认的 AI 短剧（如云月大陆）进人工黑名单无条件排除。
- 腾讯更新规则：卡片下方「每周X…」规则文案入库为 `rule` 字段；SVIP 抢先去重仅限卡片文案含 SVIP 的相邻同日集重复。
- 追番日历（日程/周/月）**不受短剧过滤影响**，按原始数据展示；月视图合并历史归档（`history.json`）实现整月数据。
- 追番列表展示以**当前周数据富集**为准（`platformInfoFor`）：历史收藏缺腾讯更新时间/链接过期时自动补全；搜索与看板共用同一 `SearchBox`（规范化标题匹配）；封面取 `FollowItem.poster`（收藏时持久化）→ 当前周数据 → 历史归档（懒加载 history.json）兜底，保证已完结/历史剧集仍有封面。
- 更新提醒为**静默浏览器通知**（顶栏铃铛已移除）：页面打开期间加载/切前台/每 30 分钟检查，同一剧集同一天只提醒一次。
- 本地存储键：追番 `anime-calendar.follows.v1`；屏蔽 `anime-calendar.blocked.v1`；主题 `anime-calendar.theme.v1`；短剧过滤 `anime-calendar.shortfilter.v1`（默认开、600s）；断更忽略 `anime-calendar.ignore-missed.v1`；通知去重 `anime-calendar.notified.v1`；云同步会话 `anime-calendar.session.v1`、同步队列 `anime-calendar.sync.pending.v1`、云同步红点已读 `anime-calendar.sync-seen.v1`；数据提示已关闭 `anime-calendar.warn-dismissed.v1`。

## 回归防复发（硬性）

爱奇艺「今天」tab 与优酷「今」tab 曾多次回归（重复点击激活 tab 清空卡片、date 字段缺失回退周一索引错位）。修改抓取器时必须遵守：

1. 当天 tab 默认激活时**不得重复点击**（先读后点，空则等待容器出现再 force 点击重试）；
2. 日期映射优先平台内联 date/week 字段；缺失时以「今/今天」tab 为锚推算，**禁止假定 tabs[0]=周一**；
3. 腾讯集数解析必须匹配带「集/话」后缀的编号（防「第2季」误当集数）；时长优先正片 vid 精确匹配；
4. `sync.mjs` 内置四平台「今天无真实条目」自检（写入 warnings，CI 输出 `::warning::`）；发布前运行 `scripts/verify/` 回归脚本（优酷秒级、爱奇艺/腾讯约 6 分钟，详见 `scripts/verify/README.md`）。

## 提交规范

Conventional Commits（`feat:` / `fix:` / `refactor:` / `chore:` / `docs:`）；主干开发，多人协作时功能分支 + squash merge。

## 发布流程（默认自动执行）

- 任何代码 / 数据 / 文档修改完成后，默认**必须自行发布**：提交（Conventional Commits）→ 推送 `main` → 触发 GitHub Actions → 确认部署 `state: success` 且线上页面可访问后，再向用户交付。
- 除非用户明确要求不发布（如仅本地验证、草稿态），否则不得省略发布步骤。
- 发布完成后在最终回复中给出推送哈希、Actions 运行链接与线上地址。

## 里程碑

- G0 设计原型（已通过）
- M0 仓库初始化与原型代码迁移（已完成）
- M1 数据管道（sync.mjs + Actions + Pages 部署，线上 https://coderLyon.github.io/anime-calendar/）
- M2 前端功能完善（追番/日历/移动端已在 M0 迁移中按审批设计落地，随 M3 统一验收）
- M3 高保真 QA（已完成，台账 `outputs/design/qa/保真度台账-M3.md`）
- M4 上线验证与 README 收尾（进行中/完成）

## 数据管道运维

- 本地同步：`pnpm run sync`（或 `npm run sync`），生成 `data/updates.json`。
- 定时任务：GitHub Actions cron `0 11,23 * * *`（UTC）= 北京 07:00/19:00；支持 `workflow_dispatch` 手动触发。
- 单平台失败会沿用上次成功数据并写 `error` 字段；只有完全无法产出数据时才退出非零。
- `pnpm-workspace.yaml` 的 `allowBuilds` 必须保留（esbuild 构建脚本，CI 安装依赖依赖它）。
