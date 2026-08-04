/** 7 项修复专项验证：同步状态、徽章筛选、追番卡布局、今日横条、铃铛角标、移动端溢出 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:4173/anime-calendar/";
const data = JSON.parse(readFileSync("data/updates.json", "utf8"));
const items = data.platforms.flatMap((p) => p.items ?? []).filter((i) => !i.predicted);
const today = new Date();
const dstr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const norm = (t) => t.replace(/[·．\s:：]/g, "").toLowerCase();

const F = {};
const add = (it) => {
  const key = norm(it.title);
  if (!F[key]) F[key] = { key, title: it.title, platforms: [], followedAt: "2026-08-01", updatedAt: "2026-08-01T00:00:00Z", notify: true };
  F[key].platforms.push({ platform: it.platform, url: it.url ?? "#", episode: it.episode, updateTime: it.updateTime });
};
for (const it of items.filter((i) => i.date === dstr(today)).slice(0, 6)) add(it);
const mianfei = items.find((i) => i.badge?.includes("限免"));
if (mianfei) add(mianfei);

let failures = 0;
const check = (name, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${extra ? ` :: ${extra}` : ""}`);
  if (!cond) failures++;
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ permissions: ["notifications"] });
await ctx.addInitScript((seed) => {
  try {
    localStorage.setItem("anime-calendar.follows.v1", JSON.stringify(seed));
    localStorage.setItem("anime-calendar.shortfilter.v1", JSON.stringify({ enabled: true, thresholdSec: 300 }));
  } catch {}
}, F);
// headless 无系统通知服务：注入 stub 模拟「通知成功展示」，验证角标去重逻辑
await ctx.addInitScript(() => {
  try {
    window.Notification = class {
      static permission = "granted";
      static requestPermission() {
        return Promise.resolve("granted");
      }
      constructor() {}
      onclick = null;
    };
  } catch {}
});

const page = await ctx.newPage();
await page.setViewportSize({ width: 390, height: 844 });

// 1) 同步状态：无文字、有状态圆点
await page.goto(`${BASE}?p=home`, { waitUntil: "networkidle" });
const syncText = (await page.locator(".sync-status").innerText()).trim();
check("云同步按钮无文字", syncText === "", syncText || "(空)");
check("云同步状态圆点已移除（仅图标颜色/首次红点）", (await page.locator(".sync-status .sync-dot").count()) === 0);

// 6) 今日横条与平台 Tab 解耦
const stripAll = await page.locator(".today-strip-label").innerText();
const tabButtons = page.locator(".toolbar .tab");
const biliTab = tabButtons.filter({ hasText: "B站" }).first();
await biliTab.click();
await page.waitForTimeout(300);
const stripBili = await page.locator(".today-strip-label").innerText();
check("今日横条不随平台 Tab 变化", stripAll === stripBili, `${stripAll} vs ${stripBili}`);
await tabButtons.filter({ hasText: "全部" }).first().click();

// 2) 限免筛选命中「逐集限免」类徽章
// 当前周限免条目多为短时长（<10 分钟），默认短剧过滤会隐藏它们：先关过滤再验证徽章筛选
await page.locator(".short-filter .chip").click();
await page.waitForTimeout(200);
const mianfeiChip = page.locator(".filter-chips .chip", { hasText: "限免" }).first();
await mianfeiChip.click();
await page.waitForTimeout(300);
const matchedText = await page.locator(".filter-bar .filter-count").innerText();
const nMatch = Number(matchedText.match(/匹配\s*(\d+)/)?.[1] ?? 0);
check("限免筛选有命中（逐集限免等变体）", nMatch > 0, matchedText);
const cardsAllMianfei = await page.evaluate(() => {
  const tags = [...document.querySelectorAll(".card .tag")].map((t) => t.textContent);
  return tags.every((t) => /限免/.test(t));
});
check("限免筛选卡片均为限免标签", cardsAllMianfei, "");
await page.locator(".filter-chips .chip", { hasText: "清除筛选" }).click();
await page.locator(".short-filter .chip").click();
await page.waitForTimeout(200);

// 2) 点映筛选命中结局点映
await page.locator(".filter-chips .chip", { hasText: "点映" }).click();
await page.waitForTimeout(300);
const nDianying = Number((await page.locator(".filter-bar .filter-count").innerText()).match(/匹配\s*(\d+)/)?.[1] ?? 0);
check("点映筛选命中结局点映条目", nDianying >= 1, `匹配 ${nDianying}`);
await page.locator(".filter-chips .chip", { hasText: "清除筛选" }).click();

// 4) 追番页卡片：站点标签在标题前、单卡无上下分栏、最新集链接行
await page.locator("header .btn.primary-soft").click();
await page.waitForTimeout(400);
check("追番页无 fi-body 分栏", (await page.locator(".fi-body").count()) === 0);
check("追番页有最新集入口", (await page.locator(".cal-item-open").count() + await page.locator(".fi-link").count()) >= 1);
const titleRowOk = await page.evaluate(() => {
  const row = document.querySelector(".fi-title-row");
  if (!row) return false;
  const first = row.firstElementChild;
  return first?.classList?.contains("plat-chip") ?? false;
});
check("站点标签位于标题前", titleRowOk);
check("追番卡无重复集数描述（无 fi-sub）", (await page.locator(".fi-sub").count()) === 0);

// 6) 铃铛角标：授权后点击提醒 → 角标消失
await page.goto(`${BASE}?p=home`, { waitUntil: "networkidle" });
await page.waitForTimeout(300);
const badgeBefore = await page.locator(".bell-badge").count();
if (badgeBefore) {
  await page.locator(".bell-btn").click();
  await page.waitForTimeout(500);
  const badgeAfter = await page.locator(".bell-badge").count();
  check("铃铛角标提醒后消失", badgeAfter === 0, `before=${badgeBefore} after=${badgeAfter}`);
} else {
  check("铃铛角标提醒后消失（无待提醒，跳过）", true);
}

// 7) 移动端整页无横向溢出（首页/追番/日历三视图）
for (const width of [360, 375, 390]) {
  await page.setViewportSize({ width, height: 780 });
  for (const q of ["p=home", "p=follow", "p=calendar&view=schedule&scope=follow", "p=calendar&view=week&scope=follow", "p=calendar&view=month&scope=follow"]) {
    await page.goto(`${BASE}?${q}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(250);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`无整页横向溢出 ${width}px ${q.split("&")[0]}`, over <= 1, `overflow=${over}`);
  }
}

await browser.close();
console.log(failures ? `\n${failures} 项失败` : "\n全部通过");
process.exit(failures ? 1 : 0);
