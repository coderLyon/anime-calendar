/** 优酷防复发：按标题定位「今/今天」tab = 北京今天；7 天 tab 日期连续不错位（秒级，纯 fetch） */
import { fetchText, extractAssignedObject, parseJsObject } from "../shared.mjs";

const html = await fetchText("https://www.youku.com/ku/webcomic", { referer: "https://www.youku.com/" });
const data = parseJsObject(extractAssignedObject(html, "__INITIAL_DATA__"));
const drawer = (data?.moduleList ?? []).find((m) => m.typeName === "FEED_DRAWER_PAGINATION");
const comp = drawer?.components?.find((c) => c.typeName === "KU_FLIX_MULTI_TAB_A");
const tabs = comp?.tabList ?? [];
if (!Array.isArray(tabs) || tabs.length !== 7) {
  console.error("FAIL: tabList 结构异常");
  process.exit(1);
}
const now = new Date(Date.now() + 8 * 3600 * 1000);
const today = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
const year = now.getUTCFullYear();
const parse = (s) => {
  const m = String(s ?? "").match(/(\d{2})\.(\d{2})/);
  if (!m) return null;
  return `${year}-${m[1]}-${m[2]}`;
};
const dates = tabs.map((t) => parse(t.date));
console.log("tab titles:", tabs.map((t) => t.title).join(","));
console.log("tab dates:", dates.join(","));
// 页面存在多种 tab 变体（如「一,今,三,四,五,六,日」）：按标题定位，不假定 index 0
const todayIdx = tabs.findIndex((t) => /^今/.test(String(t.title ?? "")));
if (todayIdx < 0) {
  console.error("FAIL: 未找到「今/今天」tab");
  process.exit(1);
}
if (dates[todayIdx] !== today) {
  console.error(`FAIL: 「今」tab 日期 ${dates[todayIdx]} ≠ 北京今天 ${today}`);
  process.exit(1);
}
for (let i = 1; i < 7; i++) {
  const prev = new Date(`${dates[i - 1]}T00:00:00+08:00`);
  const cur = new Date(`${dates[i]}T00:00:00+08:00`);
  if (Math.round((cur - prev) / 86400000) !== 1) {
    console.error(`FAIL: tab ${i} 日期不连续（${dates[i - 1]} → ${dates[i]}）`);
    process.exit(1);
  }
}
console.log("PASS: 优酷「今」tab 锚定今天且 7 天日期连续");
