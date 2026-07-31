# 动漫追番日历（anime-calendar）

聚合哔哩哔哩国创 / 腾讯视频 / 优酷 / 爱奇艺的周更动漫信息，提供「周一~周日更新看板」「追番收藏」「日历三视图（日程 / 周 / 月）」的静态站点。

## 功能

- **更新看板**：左侧星期栏 + 横向卡片（今日行高亮）；四平台 Tab（含品牌 LOGO）筛选；卡片直达最新正剧集；单日超过 12 部自动折行并显示「+N 部」展开。
- **追番收藏**：卡片星标收藏/取消（localStorage，键 `anime-calendar.follows.v1`）；同标题跨平台合并；支持搜索、平台筛选、导出/导入 JSON。
- **追番日历**：日程（当日列表 + 明日预告）/ 周视图 / 月视图（每日数量角标）；范围默认「仅已追番」，可切换「全部番剧」；「回到今天」。
- **体验**：今日追番更新摘要、深色模式（跟随系统/手动）、加载骨架屏、抓取失败重试、warnings 提示、移动端响应式（<768px 降级为星期 Tab + 单日列表）。

## 数据来源与免责声明

剧集更新数据版权归各平台所有，本项目仅供个人追番参考，请勿商用。生产数据由 GitHub Actions 定时抓取生成（详见下方「架构」），仓库内 `src/data/items.ts` 为**示例数据**，仅用于开发与设计验收。

## 本地运行

```bash
npm install
npm run dev        # 开发服务器
npm run build      # 类型检查 + 构建到 dist/
npm run preview    # 本地预览构建产物
npm run sync       # 手动同步四平台数据 → data/updates.json（需 Playwright chromium）
```

> 包管理器说明：仓库使用 pnpm（`pnpm install` / `pnpm run build` / `pnpm run sync`）；npm 命令同样可用。

## 架构

GitHub Pages 静态前端 + GitHub Actions 定时数据管道：

```
Actions（cron 0 11,23 * * * UTC + workflow_dispatch + push）
  → npm ci → playwright install chromium
  → node scripts/sync.mjs（抓取四平台 → 时长富集（B站季分集接口 / 腾讯卡片 / 优酷 show_page+播放页 / 爱奇艺 avlistinfo 分集接口）→ 短条目保留 + AI 短剧关键词/评论区启发式兜底 + 豆瓣甄别（优酷/爱奇艺缺失时长条目，限额防反爬）→ SVIP 抢先去重 → 最新集解析 → 写 data/updates.json）
  → vite build → actions/deploy-pages 发布 dist/
```

前端「短剧过滤」开关（默认开启、阈值可调 1/3/5/10/15 分钟）：仅隐藏展示，数据仍保留，关闭后可见全部条目；阈值 ≤1 分钟时额外排除优酷名称含标点符号的 AI 短剧条目。

前端构建时读取 `data/updates.json`（结构与 `AnimeItem` 契约一致，仓库内为最近一次同步结果）。单平台抓取失败时输出 `error` 字段并沿用上次成功数据，只有完全无法产出数据时同步才退出非零。

## 目录结构

```text
src/                  React 前端（tokens / 组件 / 数据契约）
  components/         页面与组件（Header、WeekdayBoard、CalendarView、FollowView…）
  data/items.ts       示例数据（M1 后由 updates.json 驱动）
  lib/                日期、平台标识、图标
  store/              localStorage（追番 / 主题）
  styles.css          设计 tokens 与组件样式（源自已审批 G0 原型）
scripts/             数据管道（sync.mjs 编排 + 四平台抓取器 + shared 工具）
data/updates.json    最近一次同步结果（npm run sync / Actions 生成）
outputs/design/       G0 设计原型交付物（可交互原型、PNG、设计规范）
work/                 本地中间产物（不入库）
```

## 部署

- 仓库：公开仓库 `anime-calendar`，默认分支 `main`。
- Pages：Settings → Pages → Source = **GitHub Actions**（由工作流产物部署）。
- `vite.config.ts` 的 `base` 与仓库名一致（`/anime-calendar/`）。

## 许可

MIT。数据版权归各平台，仅供个人追番参考，请勿商用。

## 验收与 QA

- M3 高保真 QA 已通过：逐屏对照台账见 `outputs/design/qa/保真度台账-M3.md`，应用截图见 `outputs/design/qa/`（与 `outputs/design/` 原型图同屏状态可逐张比对）。
- 自动化覆盖：桌面/移动断点矩阵（375/390/360/768）、状态栅（骨架/失败/空态/深色）、追番增删与导出导入、日历三视图与范围切换、移动滑动、键盘、触控命中区、卡片最新集跳转、真实海报加载、无控制台错误。
- 已知取舍：追番数据仅存本机 localStorage；平台抓取依赖对方页面结构，改版时按「失败即保留上次数据」降级并在 Actions 日志告警。
