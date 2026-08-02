# 动漫追番日历（anime-calendar）

聚合哔哩哔哩国创 / 腾讯视频 / 优酷 / 爱奇艺的周更动漫信息，提供「周一~周日更新看板」「追番收藏」「日历三视图（日程 / 周 / 月）」的静态站点。

![deploy](https://github.com/coderLyon/anime-calendar/actions/workflows/deploy.yml/badge.svg)

## 功能

- **更新看板**：左侧星期栏 + 横向卡片（今日行高亮）；四平台 Tab（含品牌 LOGO）筛选；卡片直达最新正剧集；单日超过 12 部自动折行并显示「+N 部」展开。
- **多周浏览**：周导航支持历史 8 周（懒加载 `data/history.json` 归档）+ 本周 + 下周「预计」；历史周无数据时显示空态说明。
- **搜索与筛选**：全站标题搜索（`/` 快捷键聚焦）+ 徽章筛选（独播/SVIP抢先/限免/超前点映/结局点映/大结局/完结）+「只看连载」，与平台 Tab、短剧过滤叠加生效。
- **断更检测**：已追番剧按更新规则（rule）在规则日无更新且未完结时标记「疑似断更」，可一键忽略；展示于追番列表与日历当日。规则来源：腾讯卡片原文 / B站官方排期文案 / 优酷与爱奇艺按星期 Tab 推导。
- **追番收藏与屏蔽**：卡片星标收藏/取消、收藏下方「屏蔽」按钮屏蔽不想看的剧（短剧过滤开启即隐藏）；同标题跨平台合并；追番列表以当前周数据富集展示（缺腾讯更新时间自动补全），卡片风格与追番日历详情一致；封面取自收藏时持久化的海报，历史/已完结剧集由当前周数据与历史归档兜底；支持搜索（与看板同一搜索框）、平台筛选、导出/导入 JSON、逐剧「提醒」开关（标题行铃铛图标）。
- **更新提醒**：静默浏览器通知（顶栏无铃铛）——页面打开期间自动检查，同一剧集同一天只提醒一次；通知授权后可收聚合文案。
- **匿名云同步（可选）**：无账号体系——首次访问自动创建设备级匿名身份（Header 云图标首次出现红点提示，查看后消失），追番/屏蔽/设置自动云端同步（Supabase + RLS）；可绑定邮箱升级跨设备；不配置则纯本地运行。
- **追番日历**：日程（当日列表 + 明日预告，详情卡含「最新集」跳转与官方更新规则）/ 周视图（本周更新 + 当日详情）/ 月视图（每行一部并带更新时间，**合并历史归档展示整月数据**）；不受短剧过滤影响（按原始数据展示）；范围默认「仅已追番」，可切换「全部番剧」；「回到今天」；下周为按本周排期推导的「预计」视图（完结剧不预测并标「完结」）。
- **PWA/离线**：可安装（manifest + 图标）、Service Worker 预缓存，离线可打开最近一次看板数据。
- **体验**：今日追番更新摘要（不受平台 Tab 影响）、深色模式（跟随系统/手动）、真实「刷新」（运行时拉取最新数据，失败回退构建时数据）、相对时间（N 小时前）、卡片时长显示、总集数展示（「共N集/话」）、短剧过滤统计（「已过滤 X 部」，手动屏蔽单独标注）、数据提示「知道了」持久关闭、加载骨架屏、抓取失败重试、warnings 提示、移动端响应式（<768px 降级为星期 Tab + 单日列表，操作按钮图标化，站点/星期选择栏横向滚动条提示）、SEO/分享（og/sitemap/robots/404/深链）。

## 数据来源与免责声明

剧集更新数据版权归各平台所有，本项目仅供个人追番参考，请勿商用。生产数据由 GitHub Actions 定时抓取生成（详见下方「架构」），仓库内 `src/data/items.ts` 为**示例数据**，仅用于开发与设计验收。

## 本地运行

```bash
npm install
npm run dev        # 开发服务器
npm run build      # 类型检查 + 构建到 dist/
npm run preview    # 本地预览构建产物
npm test           # Vitest 单元测试
npm run sync       # 手动同步四平台数据 → data/updates.json（需 Playwright chromium）
```

> 包管理器说明：仓库使用 pnpm（`pnpm install` / `pnpm run build` / `pnpm run sync`）；npm 命令同样可用。

## 架构

GitHub Pages 静态前端 + GitHub Actions 定时数据管道：

```
Actions（cron 0 11,23 * * * UTC + workflow_dispatch + push）
  → pnpm install --frozen-lockfile → playwright install chromium
  → node scripts/sync.mjs（抓取四平台（爱奇艺**频道接口优先**：`prelw/portal/lw/v5/channel/cartoon` 的「追番表」模块一次性返回 jmd_Mon~Sun 整周数据，接口缺失/校验失败才回退浏览器逐日点击，避免「今天 tab」历史复发；优酷「今」tab 锚定日期）→ 时长/总集数/更新规则富集（B站季分集接口 total + new_ep.desc 排期 / 腾讯 GetPageData 分集接口（每集秒级 duration，按 vid/集数精确匹配；总集数仅「全N集」文案）/ 优酷 show_page episodeTotal + 星期 Tab 排期，慢速+冷却重试+Playwright 浏览器兜底 / 爱奇艺频道接口星期分组 + avlistinfo 分集接口 total）→ 短条目保留 + AI 短剧关键词/评论区启发式兜底 + 豆瓣甄别（优酷/爱奇艺缺失时长条目，限额防爬）→ SVIP 抢先去重 → 最新集解析（B站排期 ep 直达/黑名单回退最新正片、优酷直达剧集页 show_page、腾讯分集列表点击解析最新正片、爱奇艺 avlistinfo 正片直达）→ 下周预计排期（未完结条目 +7 天推导）→ 四平台「今天无条目」自检告警 → 写 data/updates.json）
  → 历史归档（data/history.json，滚动保留 8 周真实条目）→ git 回写 main（[skip ci] bot 提交，供前端运行时刷新与历史导航）
  → vite build（含 PWA manifest + Service Worker）→ actions/deploy-pages 发布 dist/
```

前端「短剧过滤」开关（默认开启、阈值默认 10 分钟、可调 1/3/5/10/15 分钟）：仅隐藏展示，数据仍保留，关闭后可见全部条目；过滤开启即隐藏用户手动屏蔽的剧集，以及优酷名称含断句标点（、，。：；）的 AI 短剧条目；控件显示「已过滤 X 部」（当前周真实条目中实际被隐藏的去重剧部数，手动屏蔽单独标注）；追番日历（日程/周/月）不受短剧过滤影响，按原始数据展示。

前端构建时读取 `data/updates.json`（结构与 `AnimeItem` 契约一致）；「刷新」按钮运行时拉取 raw.githubusercontent 最新数据（jsDelivr 兜底），对比 `generatedAt` 后更新页面。单平台抓取失败时输出 `error` 字段并沿用上次成功数据，只有完全无法产出数据时同步才退出非零。

## 云同步配置（可选）

不配置时站点以纯本地 localStorage 模式运行，全部功能可用。需要跨设备同步时：

1. 在 [Supabase](https://supabase.com) 创建免费项目，打开 **Authentication → Sign In / Up → Providers**，开启 **Allow anonymous sign-ins**（匿名登录）。
2. 在项目 **SQL Editor** 中执行 `supabase/schema.sql`（4 张表 + RLS 策略，匿名/邮箱用户只能读写自己的行）。
3. 复制项目 **Project URL** 与 **anon public key**：本地写入 `.env.local`（参照 `.env.example`），CI 在仓库 Settings → Secrets and variables → Actions → Variables 注入 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`（公开 anon key 配合 RLS 是安全的）。
4. 首次访问会自动创建匿名身份；设置弹层（Header 云朵图标）可绑定邮箱升级为邮箱身份，实现真正跨设备。

> 隐私说明：清空浏览器站点数据后匿名身份凭证丢失、云端匿名数据无法找回，请绑定邮箱或定期在「追番」页导出 JSON。

## 目录结构

```text
src/                  React 前端（tokens / 组件 / 数据契约）
  components/         页面与组件（Header、WeekdayBoard、CalendarView、FollowView…）
  data/items.ts       示例数据（M1 后由 updates.json 驱动）
  lib/                日期、平台标识、图标
  store/              localStorage（追番 / 主题）
  styles.css          设计 tokens 与组件样式（源自已审批 G0 原型）
scripts/             数据管道（sync.mjs 编排 + 四平台抓取器 + shared 工具）
scripts/verify/      抓取器防复发回归脚本（优酷今天/爱奇艺今天/腾讯时长）
data/updates.json    最近一次同步结果（npm run sync / Actions 生成）
data/history.json    历史周归档（最近 8 周真实条目，前端多周导航懒加载）
supabase/schema.sql  匿名云同步表结构与 RLS 策略
tests/               Vitest 单元测试（日期/筛选/短剧过滤/断更/历史归档/同步合并）
outputs/design/       G0 设计原型交付物（可交互原型、PNG、设计规范）
work/                 本地中间产物（不入库）
```

## 部署

- 仓库：公开仓库 `anime-calendar`，默认分支 `main`。
- Pages：Settings → Pages → Source = **GitHub Actions**（由工作流产物部署）。
- `vite.config.ts` 的 `base` 与仓库名一致（`/anime-calendar/`）。
- Actions 版本基线：全部使用 Node 24 运行时（checkout@v7 / setup-node@v7 / cache@v6 / configure-pages@v6 / deploy-pages@v5 / upload-pages-artifact@v5 / pnpm-action-setup@v6），升级或回退版本时避免重新引入 Node 20 弃用警告。

## 许可

MIT。数据版权归各平台，仅供个人追番参考，请勿商用。

## 验收与 QA

- M3 高保真 QA 已通过：逐屏对照台账见 `outputs/design/qa/保真度台账-M3.md`，应用截图见 `outputs/design/qa/`（与 `outputs/design/` 原型图同屏状态可逐张比对）。
- 自动化覆盖：桌面/移动断点矩阵（375/390/360/768）、状态栅（骨架/失败/空态/深色）、追番增删与导出导入、日历三视图与范围切换、移动滑动、键盘、触控命中区、卡片最新集跳转、真实海报加载、无控制台错误。
- M5 迭代（迭代计划书 v1，见 `outputs/迭代计划书-v1.md`）：新增 Vitest 单测（`pnpm test`）+ 浏览器验证脚本（`work/verify-m5.mjs`：PWA/SW、搜索筛选、周导航、断更、同步状态、断点矩阵、零控制台错误）。
- 发布前回归清单（`AGENTS.md` 亦收录）：`pnpm test`（Vitest 47 项）→ `pnpm build` → `work/app-qa.mjs`（14 项）→ `work/verify-m5.mjs`（22 项）→ `work/verify-m5b.mjs`（25 项）→ `work/m3-qa.mjs`（16 屏，需联网验证海报）→ `scripts/verify/`（youku-today / iqiyi-today / tencent-duration / data-fields）→ 线上抽查（部署 state=success + 首页/追番页无控制台错误）。
- 已知取舍：平台抓取依赖对方页面结构，改版时按「失败即保留上次数据」降级并在 Actions 日志告警，且 `sync.mjs` 内置四平台「今天无条目」自检（CI 输出 warning），发布前运行 `scripts/verify/` 回归脚本（详见 `scripts/verify/README.md`，历史教训：爱奇艺「今天」/优酷「今」tab 多次回归，现以频道接口优先根治）；「下周预计排期」为按本周排期推导的启发式预测（`predicted` 标记），以平台实际更新为准；历史归档自 M5 起逐步累积，缺失周显示空态；浏览器通知仅在网站打开时有效（无后台推送服务）；总集数：B站/优酷/爱奇艺可取平台计划总集数，腾讯仅已完结剧（「全N集」文案）展示，连载中剧集平台未公开计划总集数；优酷/爱奇艺更新规则为星期排期推导（无具体时间），腾讯/B站为平台原文。
