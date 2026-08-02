/**
 * 数据字段防复发校验（同步后运行）：总集数（total）与更新规则（rule）覆盖度。
 * B站/优酷/爱奇艺应有大量 total 与 rule；腾讯仅完结剧有 total（「全N集」文案）。
 * 覆盖不足时输出 warning（不退出非零，避免平台反爬/接口变更导致误报阻断发布）。
 *
 * 用法：node scripts/verify/data-fields.mjs [data/updates.json]
 */
import { readFileSync } from "fs";

const file = process.argv[2] ?? new URL("../../data/updates.json", import.meta.url);
const d = JSON.parse(readFileSync(file, "utf8"));
const items = d.platforms.flatMap((p) => p.items ?? []).filter((i) => !i.predicted);

const of = (platform) => items.filter((i) => i.platform === platform);
const stats = {
  bili: { rule: of("bili").filter((i) => i.rule).length, total: of("bili").filter((i) => i.total > 0).length },
  youku: { rule: of("youku").filter((i) => i.rule).length, total: of("youku").filter((i) => i.total > 0).length },
  iqiyi: { rule: of("iqiyi").filter((i) => i.rule).length, total: of("iqiyi").filter((i) => i.total > 0).length },
  tencent: { rule: of("tencent").filter((i) => i.rule).length, total: of("tencent").filter((i) => i.total > 0).length },
};
console.log(JSON.stringify(stats, null, 1));

const low = [];
if (stats.bili.rule < 3) low.push("bili rule");
if (stats.youku.rule < 10) low.push("youku rule");
if (stats.iqiyi.rule < 3) low.push("iqiyi rule");
if (stats.bili.total < 3) low.push("bili total");
if (stats.youku.total < 10) low.push("youku total");
if (stats.iqiyi.total < 3) low.push("iqiyi total");
// 非法值检查：total 必须为正整数
const bad = items.filter((i) => i.total != null && (!Number.isInteger(i.total) || i.total <= 0));
if (bad.length) low.push(`非法 total ×${bad.length}`);
if (low.length) console.log(`::warning::数据字段覆盖不足：${low.join("，")}（请核查抓取器 rule/total 富集）`);
else console.log("data fields ok");
