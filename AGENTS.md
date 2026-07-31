# AGENTS.md — 项目协作指南

## 设计约束（硬性）

- 已审批设计规范：`outputs/design/设计规范-design-spec.md`（G0 已通过）。实现期**零自由发挥**：布局、文案、配色、交互一律以规范与原型为准；任何变更需重新过审。
- 设计 tokens 与组件样式集中在 `src/styles.css`，组件内不得写死颜色/间距替代 token。
- 响应式断点：≥1024 桌面 / 768–1023 平板 / <768 移动（周看板降级为星期 Tab + 单日列表，月历压缩为日期 + 数量角标）。

## 数据语义（重要）

- `CONTENT_BLOCKLIST`（小课堂/发布会/预告/片花/花絮/幕后/访谈/见面会/先导/抢先看）**只影响最新集解析**，不参与周表过滤；周表按平台原始更新数据展示。
- 追番日历与「今日追番更新」默认**仅已追番**，可切换全部番剧。
- 时长过滤：`duration < 600` 秒丢弃；缺失时长富集后仍缺失则关键词兜底并记入 `warnings`。
- 本地存储键：追番 `anime-calendar.follows.v1`；主题 `anime-calendar.theme.v1`。

## 提交规范

Conventional Commits（`feat:` / `fix:` / `refactor:` / `chore:` / `docs:`）；主干开发，多人协作时功能分支 + squash merge。

## 里程碑

G0 设计原型（已通过）→ M0 仓库初始化与原型代码迁移（当前）→ M1 数据管道（sync.mjs + Actions + Pages）→ M2 前端功能完善 → M3 高保真 QA → M4 上线与 README。
