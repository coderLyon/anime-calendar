# AGENTS.md — 项目协作指南

## 设计约束（硬性）

- 已审批设计规范：`outputs/design/设计规范-design-spec.md`（G0 已通过）。实现期**零自由发挥**：布局、文案、配色、交互一律以规范与原型为准；任何变更需重新过审。
- 设计 tokens 与组件样式集中在 `src/styles.css`，组件内不得写死颜色/间距替代 token。
- 响应式断点：≥1024 桌面 / 768–1023 平板 / <768 移动（周看板降级为星期 Tab + 单日列表，月历压缩为日期 + 数量角标）。

## 数据语义（重要）

- `CONTENT_BLOCKLIST`（小课堂/发布会/预告/片花/花絮/幕后/访谈/见面会/先导/抢先看）**只影响最新集解析**，不参与周表过滤；周表按平台原始更新数据展示。
- 追番日历与「今日追番更新」默认**仅已追番**，可切换全部番剧。
- 短剧过滤（前端开关）：同步**保留**全部已知时长条目（含 <300s 短条目）；前端「短剧过滤」默认开启、阈值默认 300s 可调（1/3/5/10/15 分钟，localStorage 键 `anime-calendar.shortfilter.v1`），关闭时展示全部；阈值 ≤1 分钟时额外排除优酷名称含标点符号（，。！？：；、）的条目。
- 时长富集：B站季分集接口 `api.bilibili.com/pgc/view/web/season?season_id=`（毫秒，按 episode_id 匹配、正片最新集兜底）；优酷 show_page 内联时长（秒/ISO 8601）优先 + 播放页 `pageMap.extra.duration` 兜底；爱奇艺专辑分集接口 `pcw-api.iqiyi.com/albums/album/avlistinfo?aid=`（按集数匹配、最新集兜底）。
- 内容类型排除：标题含「动态漫/AI动漫/泡面番」（AI 生成短剧）的条目在同步时直接丢弃并记入 `warnings`（与时长无关）；爱奇艺另以评论区「AI 关键字 + 负面情绪」启发式过滤（限流时优雅降级）；优酷/爱奇艺「时长缺失或 <1 分钟」条目追加豆瓣影视搜索甄别——精确命中且「暂无评分」丢弃（白名单保护正剧，如苏东坡与杭州的故事），未命中/查询失败保留，每次同步查询上限 10 次、间隔 2s（反爬约束，`scripts/douban.mjs`）；用户经评论区等渠道确认的 AI 短剧（如云月大陆）进人工黑名单无条件排除。
- 腾讯更新规则：卡片下方「每周X…」规则文案入库为 `rule` 字段；SVIP 抢先去重仅限卡片文案含 SVIP 的相邻同日集重复。
- 本地存储键：追番 `anime-calendar.follows.v1`；主题 `anime-calendar.theme.v1`。

## 提交规范

Conventional Commits（`feat:` / `fix:` / `refactor:` / `chore:` / `docs:`）；主干开发，多人协作时功能分支 + squash merge。

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
