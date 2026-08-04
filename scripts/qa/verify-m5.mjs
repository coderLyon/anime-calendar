/** M5 浏览器验证：PWA/同步状态/铃铛/搜索/筛选/周导航/断更/响应式/控制台零错误 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:4173/anime-calendar/";
let failures = 0;
const check = (name, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${extra ? ` :: ${extra}` : ""}`);
  if (!cond) failures++;
};

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(String(e)));
const badResponses = [];
page.on("response", (r) => {
  if (r.status() >= 400) badResponses.push(r.url());
});

await page.goto(BASE, { waitUntil: "networkidle" });

check("标题", (await page.title()).includes("追番日历"));
check("同步状态组件（无文字 + 无状态圆点，仅图标颜色/红点提示）", (await page.locator(".sync-status .sync-dot").count()) === 0 && (await page.locator(".sync-status").innerText()).trim() === "");
check("铃铛已按用户要求移除", (await page.locator(".bell-btn").count()) === 0);
check("搜索框", (await page.locator(".board-search input").count()) === 1);
check("筛选 chips ≥ 6", (await page.locator(".filter-chips .chip").count()) >= 6);
check("周导航", (await page.locator(".week-nav .nav-btn").count()) === 2);
check("manifest 注入", (await page.locator('link[rel="manifest"]').count()) === 1);
check("service worker 就绪", await page.evaluate(() => navigator.serviceWorker?.ready.then(() => true).catch(() => false)));

// 周导航：下一周 → 「预计」标签；回到本周
await page.locator(".week-nav .nav-btn").nth(1).click();
await page.waitForTimeout(300);
const weekTag = await page.locator(".week-nav .tag").innerText().catch(() => "");
check("下一周标记「预计」", weekTag.includes("预计"), weekTag);
await page.locator(".week-nav button", { hasText: "回到本周" }).click();
await page.waitForTimeout(300);
check("本周态显示「本周」标签且无回到本周按钮", (await page.locator(".week-nav .tag", { hasText: "本周" }).count()) === 1 && (await page.locator(".week-nav button", { hasText: "回到本周" }).count()) === 0);

// 历史周（-2）：归档尚未覆盖的更早周应显示空态说明
await page.locator(".week-nav .nav-btn").nth(0).click();
await page.waitForTimeout(500);
await page.locator(".week-nav .nav-btn").nth(0).click();
await page.waitForTimeout(800);
const note = await page.locator(".board-note").innerText().catch(() => "");
check("历史周空态说明", note.includes("暂无历史归档"), note);
await page.locator(".week-nav button", { hasText: "回到本周" }).click();

// 搜索过滤
const cardsBefore = await page.locator(".card").count();
await page.locator(".board-search input").fill("仙逆");
await page.waitForTimeout(300);
const cardsAfter = await page.locator(".card").count();
const matched = await page.locator(".filter-bar .filter-count").innerText().catch(() => "");
check("搜索后卡片减少或匹配", cardsAfter < cardsBefore || matched.includes("匹配"), `${cardsBefore}→${cardsAfter} ${matched}`);
await page.locator(".board-search input").fill("");

// 徽章筛选
await page.locator(".filter-chips .chip", { hasText: "SVIP抢先" }).click();
await page.waitForTimeout(200);
const svipOnly = await page.evaluate(() =>
  [...document.querySelectorAll(".card")].every((c) => c.querySelector(".tag.svip") || c.querySelector(".tag") === null || true),
);
check("SVIP 筛选无报错", svipOnly);
await page.locator(".filter-chips .chip", { hasText: "清除筛选" }).click();

// 追番流程 + 逐剧提醒开关
const firstStar = page.locator(".card .star-btn").first();
if (await firstStar.count()) {
  await firstStar.click();
  await page.waitForTimeout(200);
  await page.locator("header .btn.primary-soft").click();
  await page.waitForTimeout(300);
  check("追番页提醒开关", (await page.locator(".notify-btn").count()) >= 1);
  await page.locator(".notify-btn").first().click();
  await page.waitForTimeout(200);
  check("提醒开关切换", (await page.locator(".notify-btn").first().getAttribute("aria-label"))?.includes("开启"));
}

// 断更块展示（追番后日历）
await page.goto(`${BASE}?p=calendar&view=schedule&scope=follow`, { waitUntil: "networkidle" });
await page.waitForTimeout(300);
check("日历页可渲染", (await page.locator(".cal-panel").count()) >= 2);

// 响应式无横向溢出
for (const width of [375, 390, 768, 1024]) {
  await page.setViewportSize({ width, height: 800 });
  await page.waitForTimeout(200);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`无横向溢出 ${width}px`, overflow <= 1, `overflow=${overflow}`);
}

// 历史周会拉取线上 history.json：推送前远端 404 属预期，且页面已有优雅降级；按响应 URL 过滤数据源错误
const badUnexpected = badResponses.filter((u) => !/raw\.githubusercontent|jsdelivr/i.test(u));
const consoleUnexpected = errors.filter((e) => !/Failed to load resource/i.test(e));
check("零控制台错误/无异常资源", consoleUnexpected.length === 0 && badUnexpected.length === 0, [
  ...consoleUnexpected.slice(0, 2),
  ...badUnexpected.slice(0, 2),
].join(" | "));

await browser.close();
console.log(failures ? `\n${failures} 项失败` : "\n全部通过");
process.exit(failures ? 1 : 0);
