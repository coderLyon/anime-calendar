/** 爱奇艺防复发：当天（今天 tab）必须有真实条目；激活日不重复点击 */
import { scrape } from "../iqiyi.mjs";

const r = await scrape({ fetchLimit: 40, log: (m) => console.log("[iqiyi]", m) });
const now = new Date(Date.now() + 8 * 3600 * 1000);
const today = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
const n = r.items.filter((i) => i.date === today).length;
console.log(`今天(${today}) 条目数:`, n, "| 日期范围:", [...new Set(r.items.map((i) => i.date))].sort().join(","));
if (!n) {
  console.error("FAIL: 今天无条目（检查「今天」tab 激活态与懒加载）");
  process.exit(1);
}
console.log("PASS: 爱奇艺今天有数据");
