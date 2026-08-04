/* 线上抽查（临时脚本） */
import { chromium } from "playwright";

const LIVE_URL = process.env.LIVE_URL ?? "https://coderlyon.github.io/anime-calendar/";
const browser = await chromium.launch();
let failures = 0;
const errors = [];
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? ` :: ${extra}` : ""}`);
  if (!ok) failures++;
};
const captureErrors = (page, label) => {
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`${label} console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`${label} page: ${String(error)}`));
};

const p = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
captureErrors(p, "home");
const homeResponse = await p.goto(LIVE_URL, { waitUntil: "networkidle", timeout: 60000 });
await p.waitForTimeout(800);
const home = await p.evaluate(() => ({
  title: document.title,
  cards: document.querySelectorAll(".card").length,
  totals: [...document.querySelectorAll(".card .card-meta")].filter((m) => /共\d+[集话]/.test(m.textContent)).length,
  syncDot: document.querySelectorAll(".sync-dot").length,
  hint: document.querySelector(".filter-hint")?.textContent ?? null,
}));
console.log("home:", JSON.stringify(home));
check("首页返回 200", homeResponse?.status() === 200, String(homeResponse?.status()));
check("首页标题与卡片正常", home.title.includes("追番日历") && home.cards > 0, `${home.title} / cards=${home.cards}`);
check("首页总集数与过滤提示正常", home.totals > 0 && Boolean(home.hint), `totals=${home.totals} / hint=${home.hint}`);
await p.close();

const f = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
captureErrors(f, "follow");
await f.addInitScript(() => {
  try {
    localStorage.setItem(
      "anime-calendar.follows.v1",
      JSON.stringify({
        镖人: { key: "镖人", title: "镖人", followedAt: "2026-07-20", notify: true, platforms: [{ platform: "tencent", url: "https://v.qq.com/x/page/x.html", episode: "第8集", updateTime: "10:00" }] },
      }),
    );
  } catch {}
});
const followResponse = await f.goto(new URL("?p=follow", LIVE_URL).href, { waitUntil: "networkidle", timeout: 60000 });
await f.waitForTimeout(3000);
const follow = await f.evaluate(() => {
  const el = document.querySelector(".follow-item");
  const img = el?.querySelector(".poster img");
  return {
    title: el?.querySelector(".fi-title-text")?.textContent,
    posterLoaded: img ? img.complete && img.naturalWidth > 0 : false,
    starOnPoster: !!el?.querySelector(".poster .star-btn"),
    bellInTitle: !!el?.querySelector(".fi-title-row .notify-btn"),
    actionsMask: !!el?.querySelector(".fi-actions"),
  };
});
console.log("follow:", JSON.stringify(follow));
check("追番页返回 200", followResponse?.status() === 200, String(followResponse?.status()));
check("追番页卡片结构正常", follow.title === "镖人" && follow.starOnPoster && follow.bellInTitle && !follow.actionsMask, JSON.stringify(follow));
check("追番页海报加载", follow.posterLoaded);
await f.close();
await browser.close();

check("首页/追番页零控制台与页面错误", errors.length === 0, errors.join(" | "));
if (failures > 0) {
  console.error(`FAILED: ${failures} checks`);
  process.exit(1);
}
console.log("ALL PASS");
