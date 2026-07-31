/**
 * 爱奇艺动漫周更抓取（Playwright，计划 §3.4）
 * 入口：https://www.iqiyi.com/dongman/，逐日点击星期 tab 收集日历卡片。
 */
import { chromium } from "playwright";
import { addDays, createCache, httpsImg, isBlocked, ymd } from "./shared.mjs";

export const PLATFORM = "iqiyi";
export const LABEL = "爱奇艺";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const WEEKDAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const INVALID_TEXT_RE = /即将上线|敬请期待|马上看|预约|限时/;

export async function scrape({ fetchLimit = 40, log = () => {} } = {}) {
  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage({ viewport: { width: 1440, height: 1400 }, userAgent: UA });
    await page.goto("https://www.iqiyi.com/dongman/", { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(5000);
    dismissOverlay(page);

    const tabLoc = page.locator("[class*=videoCards_tab_btn]");
    const today = new Date();
    const monday = addDays(new Date(today.getFullYear(), today.getMonth(), today.getDate()), 1 - ((today.getDay() + 6) % 7));
    const items = [];
    const seen = new Set();

    for (let d = 0; d < 7; d++) {
      const label = WEEKDAYS[d];
      const tab = tabLoc.filter({ hasText: label }).first();
      if (!(await tab.count())) continue;
      await tab.click();
      await page.waitForTimeout(1300);
      dismissOverlay(page);

      // 仅取「追番表」日历卡片：优先 followCalendarCard 容器；页面存在 A/B 变体时，
      // 回退为排除「猜你喜欢」推荐区（compFuncs_simpleWrap）后取剩余卡片
      const cards = await page.evaluate(() => {
        const host = document.querySelector("[class*=followCalendarCard]");
        const els = host
          ? [...host.querySelectorAll("[class*=filmFeed_innerwrap]")]
          : [...document.querySelectorAll("[class*=filmFeed_innerwrap]")].filter((el) => !el.closest("[class*=compFuncs_simpleWrap]"));
        const out = [];
        for (const el of els) {
          if (!el.querySelector('[data-ai-entity="文案区"]') || !el.querySelector("img")) continue;
          const anchors = [...el.querySelectorAll("a[href]")];
          // 标题锚点 href 含 ext_params=a%3Dtitl（即 a=titl）；匹配失败时回退首个锚点
          const titleA = anchors.find((a) => a.getAttribute("href")?.includes("a%3Dtitl")) ?? anchors[0];
          const title = titleA?.textContent?.trim() ?? "";
          const contentEl = el.querySelector("[data-content]");
          const text = (el.textContent ?? "").replace(/\s+/g, " ");
          const img = el.querySelector("img");
          const href = anchors[0]?.getAttribute("href") ?? null;
          out.push({ title, episode: contentEl?.getAttribute("data-content") ?? "", poster: img?.getAttribute("src") ?? img?.getAttribute("data-src") ?? "", url: href, text });
        }
        return out;
      });

      const date = ymd(addDays(monday, d));
      const weekday = d + 1;
      for (const c of cards) {
        if (!c.title || INVALID_TEXT_RE.test(c.text)) continue;
        const key = `${date}:${c.title}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const epMatch = String(c.episode).match(/更新至\s*(\d+)\s*(集|话)/);
        items.push({
          id: `iqiyi-${date}-${c.title}`,
          platform: PLATFORM,
          title: c.title,
          poster: httpsImg(c.poster),
          episode: epMatch ? `第${epMatch[1]}${epMatch[2]}` : c.episode,
          updateTime: "",
          date,
          weekday,
          svip: false,
          url: c.url ? httpsImg(c.url) : "",
          badge: null,
          duration: null,
        });
      }
    }

    if (!items.length) throw new Error("未解析到任何周更卡片");
    return { platform: PLATFORM, label: LABEL, items, fetchedAt: new Date().toISOString(), warnings: [] };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    return await chromium.launch({ headless: true });
  }
}

function dismissOverlay(page) {
  page.evaluate(() => {
    document.querySelectorAll("[class*=fullCover]").forEach((el) => el.remove());
  }).catch(() => {});
}
