/**
 * 腾讯视频动漫周更抓取（Playwright，计划 §3.3）
 * 入口：https://v.qq.com/channel/cartoon，「每日更新」banner 内 7 个星期 tab + banner-card。
 * Chromium 不可用时降级 SSR（mzTitle/coverPic，无集数无日期，仅兜底）。
 */
import { chromium } from "playwright";
import { createCache, isBlocked, normUrl } from "./shared.mjs";

export const PLATFORM = "tencent";
export const LABEL = "腾讯视频";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const BADGE_RE = /(限免|独播|上新|结局点映|大结局|高清修复|超前点映)/;
const EP_RE = /更新至\s*([0-9]+|[一二三四五六七八九十百千]+|Ⅱ[0-9]+)\s*(集|话)|全\s*([0-9]+)\s*(集)|(大结局|完结)/;

const WK = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7, 末: 6 };
const fmt = (h, min) => `${String(h).padStart(2, "0")}:${String(min ?? 0).padStart(2, "0")}`;

/** 解析卡片底部更新规则 → [{days:Set<1..7>, h, min}]（「每周一、五10:00更新」/「每周二18点抢先看」/「每日0点更新」） */
function timeCandidates(t) {
  const out = [];
  for (const m of t.matchAll(/每?周([一二三四五六日天末])([^。；;0-9]{0,6}?)(\d{1,2})[:：点](\d{2})?/g)) {
    const days = new Set([WK[m[1]]]);
    for (const ch of m[2]) { const w = WK[ch]; if (w) days.add(w); }
    out.push({ days, h: Number(m[3]), min: m[4] ? Number(m[4]) : 0 });
  }
  for (const m of t.matchAll(/每[日天][^。；;0-9]{0,14}?(\d{1,2})[:：点](\d{2})?/g)) {
    out.push({ days: new Set([1, 2, 3, 4, 5, 6, 7]), h: Number(m[1]), min: m[2] ? Number(m[2]) : 0 });
  }
  return out;
}

/** 取与卡片星期匹配的时间；无匹配时退回文案首个时间 */
function timeOf(t, weekday) {
  const hit = timeCandidates(t).find((c) => c.days.has(weekday));
  if (hit) return fmt(hit.h, hit.min);
  const m = t.match(/([01]?\d|2[0-3])[:：点](\d{2})?/);
  return m ? fmt(Number(m[1]), m[2] ? Number(m[2]) : 0) : "";
}

/**
 * 识别 SVIP 抢先档期：找出与「SVIP/抢先」同句的（星期, 时间）组合；
 * 一句话里同时出现 VIP 与 SVIP 档期时，取时间更晚者（SVIP 抢先档通常晚于 VIP 常规档，如 18:00 vs 10:00）。
 * 返回 { day, h, min } 或 null（无法识别时由调用方回退为文案含 SVIP 即判定）。
 */
export function svipSlotOf(t) {
  if (!/SVIP/.test(t)) return null;
  let best = null;
  for (const m of t.matchAll(/每?周([一二三四五六日天末])([^。；;0-9]{0,6}?)(\d{1,2})[:：点](\d{2})?/g)) {
    const day = WK[m[1]];
    const h = Number(m[3]);
    const min = m[4] ? Number(m[4]) : 0;
    const clauseStart = Math.max(t.lastIndexOf("。", m.index), t.lastIndexOf("；", m.index), t.lastIndexOf(";", m.index)) + 1;
    const clause = t.slice(clauseStart, m.index + m[0].length);
    if (!/SVIP|抢先/.test(clause)) continue;
    const time = h * 60 + min;
    if (!best || time > best.time) best = { day, h, min, time };
  }
  return best;
}

export async function scrape({ fetchLimit = 40, log = () => {} } = {}) {
  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage({ viewport: { width: 1440, height: 1400 }, userAgent: UA });
    await page.goto("https://v.qq.com/channel/cartoon", { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(5000);

    const banner = page.locator(".video-banner").filter({ hasText: "每日更新" }).first();
    if (!(await banner.count())) throw new Error("页面结构变化：未找到「每日更新」banner");

    const allTabs = banner.locator(".video-banner__tabname--schedule");
    const tabCount = await allTabs.count();
    if (!tabCount) throw new Error("页面结构变化：未找到星期 tab");

    const items = [];
    const seen = new Set();
    for (let i = 0; i < tabCount; i++) {
      const tab = allTabs.nth(i);
      const insideFake = await tab.evaluate((el) => !!el.closest("#fakeTab"));
      if (insideFake) continue;
      const params = decodeURIComponent((await tab.getAttribute("dt-params")) ?? "");
      const weekMatch = params.match(/week=(\d{8})/);
      const week = weekMatch?.[1];
      if (!week) continue;
      const date = `${week.slice(0, 4)}-${week.slice(4, 6)}-${week.slice(6, 8)}`;
      const weekday = ((new Date(date).getDay() + 6) % 7) + 1;
      await tab.click();
      await page.waitForTimeout(2200);
      // 卡片懒加载：首读为空时重试
      let cardCount = await banner.locator(".banner-card--web").count();
      if (!cardCount) {
        await page.waitForTimeout(2500);
        cardCount = await banner.locator(".banner-card--web").count();
      }
      if (!cardCount) {
        log(`星期 ${date} 卡片未加载，跳过该日`);
        continue;
      }
      const cards = await banner.locator(".banner-card--web").evaluateAll((els, cfg) => {
        const EP_RE = new RegExp(cfg.epRe);
        const linkRe = /link=([^&]+)/;
        const cidRe = /(?:^|&)cid=([^&]+)/;
        const vidRe = /(?:^|&)vid=([^&]+)/;
        // 卡片下方更新规则：取「标题之后、'追' 之前」含「每周」的片段
        const ruleOf = (t, title) => {
          const i = t.indexOf(title);
          if (i < 0) return null;
          const after = t.slice(i + title.length);
          const j = after.indexOf("追");
          const seg = (j >= 0 ? after.slice(0, j) : after).trim();
          const t2 = seg.indexOf(title);
          const rule = (t2 > 0 ? seg.slice(0, t2) : seg).trim();
          return /每周/.test(rule) ? rule.slice(0, 100) : null;
        };
        return els.map((c) => {
          const paramsEl = c.querySelector(".banner-card__poster-container");
          const params = paramsEl?.getAttribute("dt-params") ?? c.getAttribute("dt-params") ?? "";
          const title = c.querySelector(".banner-card__title")?.getAttribute("title")
            ?? c.querySelector(".banner-card__title")?.textContent?.trim()
            ?? "";
          const text = (c.textContent ?? "").replace(/\s+/g, " ");
          const rule = ruleOf(text, title);
          const epMatch = text.match(EP_RE);
          const linkMatch = params.match(linkRe);
          const svipSlot = svipSlotOf(text);
          return {
            cid: params.match(cidRe)?.[1] ?? null,
            vid: params.match(vidRe)?.[1] ?? null,
            title: String(title).trim(),
            rule,
            poster: linkMatch ? decodeURIComponent(linkMatch[1]).replace(/^http:/, "https:") : null,
            episode: epMatch
              ? epMatch[1] && epMatch[2]
                ? `第${epMatch[1]}${epMatch[2]}`
                : epMatch[3] && epMatch[4]
                  ? `第${epMatch[3]}${epMatch[4]}`
                  : epMatch[5] ?? "更新"
              : null,
            updateTime: svipSlot && svipSlot.day === cfg.weekday ? fmt(svipSlot.h, svipSlot.min) : timeOf(text, cfg.weekday),
            svip: svipSlot ? svipSlot.day === cfg.weekday : text.includes("SVIP"),
            text,
          };
        });
      }, { epRe: EP_RE.source, badgeRe: BADGE_RE.source, weekday });
      for (const c of cards) {
        if (!c.cid || !c.title) continue;
        const dedupKey = `${date}:${c.cid}`;
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);
        items.push({
          id: `tencent-${c.cid}-${date}`,
          platform: PLATFORM,
          title: c.title,
          rule: c.rule,
          poster: c.poster,
          episode: c.episode ?? "",
          updateTime: c.updateTime ?? "",
          date,
          weekday,
          svip: c.svip,
          url: c.vid ? `https://v.qq.com/x/page/${c.vid}.html` : `https://v.qq.com/x/cover/${c.cid}.html`,
          badge: c.text.match(BADGE_RE)?.[1] ?? null,
          duration: null,
        });
      }
    }
    if (!items.length) throw new Error("未解析到任何周更卡片");

    const deduped = dedupPipeline(items, log);
    await resolveLatestVideos(deduped, browser, { fetchLimit, log });
    return { platform: PLATFORM, label: LABEL, items: deduped, fetchedAt: new Date().toISOString(), warnings: [] };
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

/** 去重管线（顺序固定，计划 §3.3） */
function dedupPipeline(items, log) {
  let out = [...items];
  out = dedupAdjacentSvipEarly(out, log);
  out = dedupFinaleEarlyRelease(out, log);
  out = dedupMonSunSameWeek(out, log);
  return out;
}

/**
 * 相邻两天同标题同集去重：
 * - 仅当卡片规则文案涉及 SVIP（如「SVIP抢先看 / SVIP权益加码 / SVIP会员每周X抢先」）时，
 *   判定为 SVIP 抢先 + 常规更新重复，留早（SVIP 日）删晚（常规日）。
 * - 多日更新剧（如「每周四、五、六、日各更新1集」）的卡片集数文案在周末可能不刷新，
 *   出现相邻日同集数，但并无 SVIP —— 不能按抢先去重删除，否则会过度过滤。
 */
function dedupAdjacentSvipEarly(items, log) {
  const groups = groupBy(items, (i) => `${i.title}:${i.episode}`);
  const remove = new Set();
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const sorted = [...g].sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      const diff = dayDiff(prev.date, cur.date);
      if (diff === 1 && (prev.svip || cur.svip)) remove.add(cur);
    }
  }
  if (remove.size) log(`SVIP 抢先相邻去重：移除 ${remove.size} 条`);
  return items.filter((i) => !remove.has(i));
}

/** 结局点映只留首日 */
function dedupFinaleEarlyRelease(items, log) {
  const groups = groupBy(items, (i) => `${i.title}:${i.episode}`);
  const remove = new Set();
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const finale = g.filter((i) => i.badge === "结局点映");
    if (!finale.length) continue;
    const first = [...g].sort((a, b) => a.date.localeCompare(b.date))[0];
    for (const other of g) if (other !== first) remove.add(other);
  }
  if (remove.size) log(`结局点映去重：保留首日，移除 ${remove.size} 条`);
  return items.filter((i) => !remove.has(i));
}

/** 同周周一 + 周日同集留周日：仅当涉及 SVIP（周日为 SVIP 抢先日、周一为常规更新）时生效 */
function dedupMonSunSameWeek(items, log) {
  const groups = groupBy(items, (i) => `${i.title}:${i.episode}`);
  const remove = new Set();
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const byDate = new Map(g.map((i) => [i.date, i]));
    for (const [date, it] of byDate) {
      const d = new Date(date);
      if (d.getDay() === 1) {
        // 周一：检查同周周日
        const sunday = new Date(d);
        sunday.setDate(d.getDate() + 6);
        const sundayKey = toYmd(sunday);
        if (byDate.has(sundayKey) && (it.svip || byDate.get(sundayKey).svip)) remove.add(it);
      }
    }
  }
  if (remove.size) log(`周一+周日去重：保留周日，移除 ${remove.size} 条`);
  return items.filter((i) => !remove.has(i));
}

/** 最新正剧集 URL 解析（extractLatestVid）：封面页富集，读落地 vid，按 (platform, cid) 缓存 */
async function resolveLatestVideos(items, browser, { fetchLimit, log }) {
  const cache = createCache();
  const cidOf = (i) => i.id.split("-")[1];
  const uniq = [...new Map(items.filter((i) => /\/x\/cover\//.test(i.url)).map((i) => [cidOf(i), i])).values()];
  let fetched = 0;
  for (const it of uniq) {
    if (fetched >= fetchLimit) break;
    const cid = cidOf(it);
    if (cache.get(cid) !== undefined) continue;
    fetched++;
    try {
      const vid = await extractLatestVid(browser, cid, log);
      cache.set(cid, vid);
      if (vid) it.url = `https://v.qq.com/x/page/${vid}.html`;
    } catch (err) {
      cache.set(cid, null);
      log(`最新集解析失败 ${it.title}: ${err.message}`);
    }
  }
  for (const it of items) {
    const cid = cidOf(it);
    const vid = cache.get(cid);
    if (vid) it.url = `https://v.qq.com/x/page/${vid}.html`;
  }
}

async function extractLatestVid(browser, cid, log) {
  const page = await browser.newPage({ userAgent: UA });
  try {
    await page.goto(`https://v.qq.com/x/cover/${cid}.html`, { waitUntil: "domcontentloaded", timeout: 35000 });
    await page.waitForTimeout(3500);
    // 1) 落地重定向即最新集
    const url = page.url();
    const redirected = url.match(/\/x\/cover\/[^/]+\/([a-z0-9]+)\.html/);
    if (redirected) return redirected[1];
    // 2) 分集列表：切到最后一个数字区间，扫描取最大正剧集
    const nums = await page.locator("text=/^\\d+-\\d+$/").allTextContents();
    const last = nums[nums.length - 1];
    if (last) {
      const btn = page.locator(`text=/^${last}$/`).first();
      await btn.click().catch(() => {});
      await page.waitForTimeout(1800);
    }
    const list = page.locator(".episode-list li");
    const count = await list.count();
    if (count) {
      const parsed = [];
      for (let i = 0; i < count; i++) {
        const el = list.nth(i);
        const text = (await el.textContent().catch(() => "")) ?? "";
        const params = (await el.getAttribute("dt-params").catch(() => null)) ?? "";
        const num = text.match(/(\d+)/);
        parsed.push({ text, num: num ? Number(num[1]) : -1, params });
      }
      const valid = parsed.filter((p) => p.num > 0 && !isBlocked(p.text));
      valid.sort((a, b) => b.num - a.num);
      const top = valid[0];
      if (top) {
        const vid = top.params.match(/(?:^|&)vid=([^&]+)/)?.[1];
        if (vid) return decodeURIComponent(vid);
      }
    }
    return null;
  } finally {
    await page.close().catch(() => {});
  }
}

function groupBy(items, keyFn) {
  const map = new Map();
  for (const it of items) {
    const k = keyFn(it);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(it);
  }
  return map;
}

function dayDiff(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

function toYmd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
