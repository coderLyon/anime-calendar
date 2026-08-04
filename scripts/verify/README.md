# 抓取器防复发回归脚本

修改 `scripts/` 抓取器（尤其涉及星期 tab、日期映射、「今天/今」tab、时长匹配）后，发布前必须运行对应验证脚本；CI 中 `sync.mjs` 也会对四平台做「今天无真实条目」自检（写入 warnings，并在 Actions 输出 `::warning::`）。

| 脚本 | 验证内容 | 耗时 |
|---|---|---|
| `node scripts/verify/youku-today.mjs` | 优酷按标题定位「今/今天」tab 锚定今天（**不假定 index 0**，页面存在「一,今,三,四…」变体）、7 天日期连续不错位 | 秒级 |
| `node scripts/verify/iqiyi-today.mjs` | 爱奇艺当天有数据（v7 频道接口优先 + 浏览器补时，逐日点击兜底） | 秒级（接口通道）/ 约 6 分钟（兜底） |
| `node scripts/verify/tencent-duration.mjs` | 腾讯 GetPageData 时长匹配（季号不误当集数、斩神/茶啊二中 >300s） | 约 6 分钟 |
| `node scripts/verify/data-fields.mjs` | 同步后 total（总集数）与 rule（更新规则）覆盖度 + 非法值检查（CI 同款，不足时 `::warning::` 不阻断） | 秒级 |

历史教训：爱奇艺「今天」tab 与优酷「今」tab 曾多次回归（重复点击激活 tab 导致卡片清空、date 字段缺失回退周一索引导致错位）。任何抓取器改动都不得破坏以下约定：

1. 爱奇艺优先走频道接口（`mesh.if.iqiyi.com/portal/lw/v7/channel/cartoon`「追番表」jmd_Mon~Sun），禁止把激活日 tab 的 force 点击作为主要手段（页面存在虚拟化/AB 变体，部分星期按钮可能不在 DOM）；
2. 当天 tab 若默认激活，不得重复点击（先读后点，空则滚动重试，最后才「切走再切回」）；
3. 日期映射优先平台内联 date/week 字段；缺失时以「今/今天」tab 为锚推算，禁止直接假定 tabs[0]=周一；
4. 腾讯集数解析必须匹配「第N集/话」（带后缀），禁止把「第2季」当集数；
5. 时长匹配优先正片 vid 精确命中，其次按集数，禁止直接取列表末项（可能为预告/花絮）。
6. 总集数：B站 season API `total`、优酷 `episodeTotal`、爱奇艺 avlistinfo `total`；腾讯仅「全N集」文案，禁止对连载中剧集推断（避免把「已更新N集」误作总集数）。
7. 更新规则：腾讯卡片原文、B站 `new_ep.desc`、优酷/爱奇艺按星期 Tab 推导（仅未完结剧），禁止给已完结剧生成周更规则。
