/* M0 构建产物浏览器验证 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:4173/anime-calendar/";
const browser = await chromium.launch();
let fails = 0;
const check = (name, ok, extra = "") => {
  console.log(ok ? "PASS" : "FAIL", name, extra);
  if (!ok) fails++;
};

/* 桌面首页 */
let p = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
p.on("pageerror", (e) => errors.push(String(e)));
await p.goto(BASE + "?p=home", { waitUntil: "networkidle" });
await p.waitForTimeout(300);
let r = await p.evaluate(() => ({
  rows: document.querySelectorAll(".day-row").length,
  cards: document.querySelectorAll(".card").length,
  tabs: document.querySelectorAll(".tab").length,
  logos: document.querySelectorAll(".tab .plat-logo").length,
  todayRow: !!document.querySelector(".day-row.today"),
  strip: document.querySelector(".today-strip-label")?.textContent ?? "",
  count: document.getElementById("root") ? document.querySelector(".count-pill")?.textContent : "",
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
}));
check("home: 7 rows / >=50 cards（单日 12 张封顶）/ 5 tabs / 4 logos", r.rows === 7 && r.cards >= 50 && r.tabs === 5 && r.logos === 4, JSON.stringify(r));
check("home: today row + 追番 strip（初始 0 追番）", r.todayRow && r.strip.includes("今日追番更新 · 0"), r.strip);
check("home: no overflow", r.overflow <= 1, "overflow=" + r.overflow);

/* 短剧过滤控件（默认开启） */
r = await p.evaluate(() => ({
  has: !!document.querySelector(".short-filter .chip"),
  meta: document.querySelector(".tab .tab-count")?.textContent ?? "",
}));
check("short-filter: 控件存在且默认开启", r.has && /(\d+)/.test(r.meta), r.meta);
const nOn = Number(r.meta.match(/(\d+)/)?.[1] ?? 0);
await p.click(".short-filter .chip");
await p.waitForTimeout(200);
r = await p.evaluate(() => ({ meta: document.querySelector(".tab .tab-count")?.textContent ?? "" }));
const nOff = Number(r.meta.match(/(\d+)/)?.[1] ?? 0);
check("short-filter: 关闭后条目数增加", nOff > nOn, `on=${nOn} off=${nOff}`);
await p.click(".short-filter .chip");
await p.waitForTimeout(200);

/* 星标追番：收藏「今天」行第一部 */
await p.locator(".day-row.today .star-btn").first().click();
await p.waitForTimeout(200);
r = await p.evaluate(() => ({
  count: document.querySelector(".count-pill")?.textContent,
  followed: document.querySelectorAll(".card.followed").length,
  strip: document.querySelector(".today-strip-label")?.textContent ?? "",
}));
// 同标题跨平台合并：星标后可能同时高亮多张同剧卡片（如多平台同步更新的番）
check("follow: 星标后计数 1 / 卡片高亮 / 今日追番 1", r.count === "1" && r.followed >= 1 && r.strip.includes("· 1"), JSON.stringify(r));

/* 主题切换 */
await p.click('.app-header button.icon-btn[title*="切换"]');
await p.waitForTimeout(700);
r = await p.evaluate(() => ({ theme: document.documentElement.dataset.theme, bg: getComputedStyle(document.body).backgroundColor }));
check("theme: 切到深色", r.theme === "dark" && Number(r.bg.match(/\d+/)?.[0] ?? 255) < 80, JSON.stringify(r));
await p.click('.app-header button.icon-btn[title*="切换"]');
await p.waitForTimeout(200);
await p.close();

/* 导航 + 日历 */
p = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
p.on("pageerror", (e) => errors.push(String(e)));
await p.goto(BASE + "?p=home", { waitUntil: "networkidle" });
await p.waitForTimeout(250);
await p.click('header button:has-text("追番日历")');
await p.waitForTimeout(200);
r = await p.evaluate(() => ({
  page: document.querySelector("h1")?.textContent,
  activeView: [...document.querySelectorAll(".cal-controls .segmented")][1]?.querySelector(".active")?.textContent ?? null,
  weekGrid: !!document.querySelector(".week-grid"),
  backBtn: [...document.querySelectorAll(".page-head button")].some((b) => (b.textContent ?? "").includes("返回看板")),
  scope: document.querySelector("#calScope") ? [...document.querySelectorAll(".segmented:first-of-type button")].map((b) => b.textContent) : null,
  empty: document.querySelectorAll(".empty").length,
}));
check("calendar: 默认周视图 + 返回看板按钮", r.activeView === "周视图" && r.weekGrid && r.backBtn, JSON.stringify(r));
check("calendar: 默认仅已追番为空态", r.page === "追番日历" && r.empty >= 1, JSON.stringify(r));
await p.click('button:has-text("全部番剧")');
await p.waitForTimeout(200);
await p.click('button:has-text("日程")');
await p.waitForTimeout(200);
r = await p.evaluate(() => ({ items: document.querySelectorAll(".cal-item").length, preview: document.querySelectorAll(".preview-item").length }));
check("calendar: 全部番剧 → 今日有数据 + 明日预览", r.items >= 1 && r.preview >= 1, JSON.stringify(r));
await p.click('button:has-text("月视图")');
await p.waitForTimeout(200);
r = await p.evaluate(() => ({ cells: document.querySelectorAll(".month-cell").length, badges: document.querySelectorAll(".month-cell .cnt").length }));
check("calendar: 月视图 >=35 格 / 有角标", r.cells >= 35 && r.badges >= 1, JSON.stringify(r));
await p.close();

/* 追番列表 */
p = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
p.on("pageerror", (e) => errors.push(String(e)));
await p.goto(BASE + "?p=home", { waitUntil: "networkidle" });
await p.waitForTimeout(250);
await p.click("header .btn.primary-soft");
await p.waitForTimeout(200);
r = await p.evaluate(() => ({ page: document.querySelector("h1")?.textContent, items: document.querySelectorAll(".follow-item").length, empty: document.querySelectorAll(".empty").length }));
check("follow: 页面可达", r.page === "追番列表" && r.items === 0 && r.empty === 1, JSON.stringify(r));
await p.close();

/* 移动端 */
p = await browser.newPage({ viewport: { width: 390, height: 844 } });
p.on("pageerror", (e) => errors.push(String(e)));
await p.goto(BASE + "?p=home", { waitUntil: "networkidle" });
await p.waitForTimeout(300);
r = await p.evaluate(() => ({
  mBoard: getComputedStyle(document.querySelector(".m-board")).display !== "none",
  desktopBoard: getComputedStyle(document.querySelector(".board")).display !== "none",
  mTabs: document.querySelectorAll(".m-tab").length,
  mCards: document.querySelectorAll(".m-card").length,
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
}));
check("mobile: 单日列表 + 星期 Tab，无溢出", r.mBoard && !r.desktopBoard && r.mTabs === 7 && r.mCards >= 1 && r.overflow <= 1, JSON.stringify(r));
await p.close();

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
console.log(fails ? fails + " FAILURES" : "ALL PASS");
process.exit(fails ? 1 : 0);
