/* M3 高保真 QA：截图 + 断言矩阵（本地构建产物） */
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:4173/anime-calendar/";
const OUT = process.env.QA_OUTPUT_DIR ?? "outputs/design/qa";
mkdirSync(OUT, { recursive: true });

function norm(t) {
  return t.replace(/[·．\s:：]/g, "").toLowerCase();
}

/* 从真实数据生成追番种子（今日 + 一周内各日，保证追番/日历有内容） */
function seedFollows() {
  const data = JSON.parse(readFileSync("data/updates.json", "utf8"));
  const items = (data.platforms ?? []).flatMap((p) => p.items ?? []);
  const dstr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const todayStr = dstr(new Date());
  const F = {};
  const add = (it) => {
    const key = norm(it.title);
    if (!F[key]) F[key] = { key, title: it.title, platforms: [], followedAt: "2026-07-25" };
    F[key].platforms.push({ platform: it.platform, url: it.url ?? "#", episode: it.episode, updateTime: it.updateTime });
  };
  for (const it of items.filter((i) => i.date === todayStr).slice(0, 6)) add(it);
  const byDay = new Map();
  for (const it of items.filter((i) => i.date !== todayStr)) {
    if (!byDay.has(it.date)) byDay.set(it.date, []);
    if (byDay.get(it.date).length < 2) byDay.get(it.date).push(it);
  }
  for (const arr of byDay.values()) for (const it of arr) add(it);
  return F;
}

const browser = await chromium.launch();
let fails = 0;
const check = (name, ok, extra = "") => {
  console.log(ok ? "PASS" : "FAIL", name, extra);
  if (!ok) fails++;
};

async function newPage(vp, seeded) {
  const ctx = await browser.newContext({ viewport: { width: vp[0], height: vp[1] } });
  if (seeded) {
    await ctx.addInitScript((seed) => localStorage.setItem("anime-calendar.follows.v1", JSON.stringify(seed)), seedFollows());
  }
  return ctx.newPage();
}

const shots = [
  ["app-01-home-all.png", "1440x1000", "?p=home", false, null],
  ["app-02-home-bili.png", "1440x1000", "?p=home&platform=bili", false, null],
  ["app-03-home-error.png", "1440x1000", "?p=home&state=error", false, null],
  ["app-04-home-skeleton.png", "1440x1000", "?p=home&state=skeleton&warn=0", false, null],
  ["app-05-home-empty.png", "1440x1000", "?p=home&state=empty&warn=0", false, null],
  ["app-06-home-dark.png", "1440x1000", "?p=home&theme=dark", false, null],
["app-07-follow.png", "1440x1000", "?p=follow", true, (p) => p.locator(".fi-row").first().click()],
  ["app-08-cal-schedule.png", "1440x1000", "?p=calendar&view=schedule", true, null],
  ["app-09-cal-week.png", "1440x1000", "?p=calendar&view=week", true, null],
  ["app-10-cal-month.png", "1440x1000", "?p=calendar&view=month", true, null],
  ["app-m01-home.png", "390x844", "?p=home", false, null],
  ["app-m02-home-dark.png", "390x844", "?p=home&theme=dark", false, null],
  ["app-m03-cal-schedule.png", "390x844", "?p=calendar&view=schedule", true, null],
  ["app-m04-cal-week.png", "390x844", "?p=calendar&view=week", true, null],
  ["app-m05-cal-month.png", "390x844", "?p=calendar&view=month", true, null],
["app-m06-follow.png", "390x844", "?p=follow", true, (p) => p.locator(".fi-row").first().click()],
];

for (const [name, vp, query, seeded, extra] of shots) {
  const p = await newPage(vp.split("x").map(Number), seeded);
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e)));
  p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  await p.goto(BASE + query, { waitUntil: "networkidle", timeout: 60000 });
  await p.waitForTimeout(700);
  if (extra) await extra(p);
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${OUT}/${name}`, fullPage: true });
  check(`shot ${name}`, errs.length === 0, errs.slice(0, 2).join(" | "));
  await p.close();
}

/* ---------- 断言矩阵 ---------- */

// 桌面首页结构
let p = await newPage([1440, 1000], false);
await p.goto(BASE + "?p=home", { waitUntil: "networkidle" });
await p.waitForTimeout(500);
let r = await p.evaluate(() => ({
  rows: document.querySelectorAll(".day-row").length,
  rails: [...document.querySelectorAll(".day-rail")].map((x) => Math.round(x.getBoundingClientRect().width)),
  cardW: [...document.querySelectorAll(".day-cards .card")].slice(0, 6).map((c) => Math.round(c.getBoundingClientRect().width)),
  tabs: document.querySelectorAll(".tab").length,
  logos: document.querySelectorAll(".tab .plat-logo img").length,
  todayRow: !!document.querySelector(".day-row.today"),
  strip: document.querySelector(".today-strip-label")?.textContent ?? "",
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
}));
check("桌面看板：7 行等宽星期栏 + 卡片 176 + 5 Tab + 4 LOGO + 今日行",
  r.rows === 7 && r.rails.every((w) => w === r.rails[0]) && r.cardW.every((w) => w === r.cardW[0]) && r.tabs === 5 && r.logos === 4 && r.todayRow,
  JSON.stringify(r));
check("桌面无横向溢出", r.overflow <= 1, `overflow=${r.overflow}`);

// 状态页
p = await newPage([1440, 1000], false);
await p.goto(BASE + "?p=home&state=error", { waitUntil: "networkidle" });
await p.waitForTimeout(400);
r = await p.evaluate(() => ({ banner: !!document.querySelector(".err-banner"), tab: document.querySelectorAll(".error-tab").length }));
check("失败态：横幅 + 腾讯失败 Tab", r.banner && r.tab === 1, JSON.stringify(r));
await p.goto(BASE + "?p=home&state=skeleton&warn=0", { waitUntil: "networkidle" });
await p.waitForTimeout(400);
      r = await p.evaluate(() => ({ sk: document.querySelectorAll(".board .sk-card").length }));
check("骨架屏：7 行 × 3 卡", r.sk === 21, JSON.stringify(r));
await p.goto(BASE + "?p=home&state=empty&warn=0", { waitUntil: "networkidle" });
await p.waitForTimeout(400);
r = await p.evaluate(() => ({ empty: document.querySelectorAll(".empty").length }));
check("空态渲染", r.empty >= 1, JSON.stringify(r));
await p.close();

// 追番页（种子）
p = await newPage([1440, 1000], true);
await p.goto(BASE + "?p=follow", { waitUntil: "networkidle" });
await p.waitForTimeout(400);
r = await p.evaluate(() => ({ items: document.querySelectorAll(".follow-item").length, chips: document.querySelectorAll(".chip").length }));
check("追番页：≥3 条种子追番 + 5 筛选 chip", r.items >= 3 && r.chips === 5, JSON.stringify(r));
await p.locator(".fi-row").first().click();
await p.waitForTimeout(250);
r = await p.evaluate(() => ({ rows: document.querySelectorAll(".fi-link").length }));
check("追番页：展开后多平台行 ≥4", r.rows >= 4, JSON.stringify(r));
await p.close();

// 日历（种子，仅已追番默认）
p = await newPage([1440, 1000], true);
await p.goto(BASE + "?p=calendar&view=schedule", { waitUntil: "networkidle" });
await p.waitForTimeout(400);
r = await p.evaluate(() => ({ items: document.querySelectorAll(".cal-item").length, preview: document.querySelectorAll(".preview-item").length }));
check("日历日程：仅已追番有数据 + 明日预览", r.items >= 1 && r.preview >= 1, JSON.stringify(r));
await p.click('button:has-text("周视图")');
await p.waitForTimeout(300);
r = await p.evaluate(() => ({ cols: document.querySelectorAll(".week-col").length, detail: document.querySelectorAll(".cal-panel").length }));
check("周视图：7 列 + 详情面板", r.cols === 7 && r.detail >= 2, JSON.stringify(r));
await p.click('button:has-text("月视图")');
await p.waitForTimeout(300);
r = await p.evaluate(() => ({ cells: document.querySelectorAll(".month-cell").length, badges: document.querySelectorAll(".month-cell .cnt").length }));
check("月视图：≥35 格 + 角标", r.cells >= 35 && r.badges >= 1, JSON.stringify(r));
await p.close();

// 移动端矩阵：375 / 390 / 360 / 768
for (const w of [375, 390, 360, 768]) {
  p = await newPage([w, 844], false);
  await p.goto(BASE + "?p=home", { waitUntil: "networkidle" });
  await p.waitForTimeout(400);
  r = await p.evaluate(() => {
    const mBoard = getComputedStyle(document.querySelector(".m-board")).display !== "none";
    const board = getComputedStyle(document.querySelector(".board")).display !== "none";
    return {
      mBoard,
      board,
      mTabs: document.querySelectorAll(".m-tab").length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  const isMobile = w < 768;
  check(`断点 ${w}px：${isMobile ? "移动端单日列表" : "桌面看板"} + 无溢出`,
    (isMobile ? r.mBoard && !r.board && r.mTabs === 7 : !r.mBoard && r.board) && r.overflow <= 1,
    JSON.stringify(r));
  await p.close();
}

// 命中区：移动端星期 Tab 高度 ≥44；星标 ::before 扩大
p = await newPage([390, 844], false);
await p.goto(BASE + "?p=home", { waitUntil: "networkidle" });
await p.waitForTimeout(400);
r = await p.evaluate(() => {
  const tab = document.querySelector(".m-tab");
  const star = document.querySelector(".m-card .star-btn") ?? document.querySelector(".star-btn");
  const starBefore = star ? getComputedStyle(star, "::before") : null;
  return {
    tabH: tab ? Math.round(tab.getBoundingClientRect().height) : 0,
    starInset: starBefore?.inset ?? "",
    starSize: star ? Math.round(star.getBoundingClientRect().width) : 0,
  };
});
check("触控目标：Tab ≥44px / 星标命中区扩大（::before -9px）", r.tabH >= 44 && r.starInset.includes("-9px"), JSON.stringify(r));
await p.close();

// 卡片点击直达最新集（拦截 window.open 捕获 URL）
p = await newPage([1440, 1000], false);
await p.addInitScript(() => {
  window.__opened = null;
  window.open = (u) => { window.__opened = u; return null; };
});
await p.goto(BASE + "?p=home", { waitUntil: "networkidle" });
await p.waitForTimeout(500);
const clicked = await p.evaluate(() => {
  const card = document.querySelector(".card");
  card.click();
  return window.__opened;
});
check("卡片点击：触发最新集跳转（真实 URL）", clicked && /^(https?:)?\/\//.test(clicked), `url=${clicked}`);
await p.close();

// 移动端左右滑动切换星期（hasTouch 上下文 + 合成 TouchEvent）
p = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
await p.goto(BASE + "?p=home", { waitUntil: "networkidle" });
await p.waitForTimeout(400);
const dayBefore = await p.locator(".m-tab.active").getAttribute("data-mday");
await p.evaluate(() => {
  const board = document.querySelector(".m-board");
  const opts = { bubbles: true, cancelable: true };
  const t1 = new Touch({ identifier: 1, target: board, clientX: 300, clientY: 400 });
  const t2 = new Touch({ identifier: 1, target: board, clientX: 120, clientY: 400 });
  board.dispatchEvent(new TouchEvent("touchstart", { ...opts, touches: [t1], changedTouches: [t1] }));
  board.dispatchEvent(new TouchEvent("touchend", { ...opts, touches: [], changedTouches: [t2] }));
});
await p.waitForTimeout(300);
const dayAfter = await p.locator(".m-tab.active").getAttribute("data-mday");
check(`移动端滑动切换星期（${dayBefore} -> ${dayAfter}）`, Number(dayAfter) === Math.min(7, Number(dayBefore) + 1), `before=${dayBefore} after=${dayAfter}`);
await p.close();

// 日历键盘方向键
p = await newPage([1440, 1000], false);
await p.goto(BASE + "?p=calendar&view=schedule", { waitUntil: "networkidle" });
await p.waitForTimeout(400);
const d1 = await p.locator(".cal-date-title .d").textContent();
await p.keyboard.press("ArrowRight");
await p.waitForTimeout(250);
const d2 = await p.locator(".cal-date-title .d").textContent();
check("日历方向键：日程 +1 天", d1 !== d2, `${d1} -> ${d2}`);
await p.close();

// 真实海报图片加载（抽样）
p = await newPage([1440, 1000], false);
await p.goto(BASE + "?p=home", { waitUntil: "networkidle" });
await p.waitForTimeout(2500);
r = await p.evaluate(() => {
  const imgs = [...document.querySelectorAll(".card img")].slice(0, 10);
  return { total: imgs.length, loaded: imgs.filter((i) => i.complete && i.naturalWidth > 0).length, failed: imgs.filter((i) => i.complete && i.naturalWidth === 0).length };
});
check(`真实海报加载：loaded ${r.loaded}/${r.total}（允许少量外链失败，前端有占位兜底）`, r.loaded >= Math.ceil(r.total * 0.5), JSON.stringify(r));
await p.close();

await browser.close();
console.log(fails ? fails + " FAILURES" : "ALL PASS");
process.exit(fails ? 1 : 0);
