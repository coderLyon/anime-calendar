/**
 * 优酷动漫周更抓取（SSR，计划 §3.2）
 * 入口：GET https://www.youku.com/ku/webcomic，解析 window.__INITIAL_DATA__ 的「每日更新」模块
 * （KU_FLIX_MULTI_TAB_A：tabList 7 个星期 tab + itemList 7 个数组一一对应）
 */
import { createCache, extractAssignedObject, fetchText, httpsImg, mondayOfWeekBeijing, parseJsObject, weeklyRuleFor, ymd } from "./shared.mjs";

export const PLATFORM = "youku";
export const LABEL = "优酷";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FINISHED_RE = /(大结局|完结|已完结|全\s*\d+\s*(话|集)|\d+\s*(话|集)\s*全)/;

export async function scrape({ fetchLimit = 40, log = () => {} } = {}) {
  const html = await fetchText("https://www.youku.com/ku/webcomic", { referer: "https://www.youku.com/" });
  const dataText = extractAssignedObject(html, "__INITIAL_DATA__");
  if (!dataText) throw new Error("页面结构变化：未找到 window.__INITIAL_DATA__");
  const data = parseJsObject(dataText);

  const drawer = (data?.moduleList ?? []).find((m) => m.typeName === "FEED_DRAWER_PAGINATION");
  const comp = drawer?.components?.find((c) => c.typeName === "KU_FLIX_MULTI_TAB_A");
  const tabs = comp?.tabList;
  const lists = comp?.itemList;
  if (!Array.isArray(tabs) || !Array.isArray(lists) || tabs.length !== 7 || lists.length !== 7) {
    throw new Error("页面结构变化：未找到「每日更新」7 天 tab/itemList");
  }

  const items = [];
  for (let d = 0; d < 7; d++) {
    const tab = tabs[d];
    const dayItems = lists[d];
    if (!Array.isArray(dayItems)) continue;
        const date = tabDate(tab.date, d, tabs);
        const weekday = d + 1;
    for (const it of dayItems) {
      const title = String(it.title ?? it.trackInfo?.object_title ?? "").trim();
      if (!title) continue;
      const reason = String(it.reason?.text?.title ?? "");
      const m = reason.match(/(\d{1,2}:\d{2})/);
      const svip = reason.includes("SVIP");
      const epMatch = String(it.lbTexts ?? "").match(/更新至\s*(\d+)\s*(话|集)/);
      items.push({
        id: `youku-${it.action_value}-${date}`,
        platform: PLATFORM,
        title,
        poster: httpsImg(it.img || it.hImg),
        episode: epMatch ? `第${epMatch[1]}${epMatch[2]}` : String(it.lbTexts ?? ""),
          updateTime: m ? m[1] : "",
          date,
          weekday,
          svip,
        // 直达剧集页：previewInfo.videoId 是预览短片（片花/预告）而非正片，不能作卡片直达链接；
        // show_page 在浏览器中会落到该动漫的播放界面（选集可选最新集）。
        url: `https://www.youku.com/show_page/id_${it.action_value}.html`,
        videoId: it.previewInfo?.videoId ?? null, // 播放页兜底用（X+base64 形式的 videoId）
        badge: it.mark?.text || it.mark?.iconfont || null,
        duration: null,
      });
    }
  }

  if (!items.length) throw new Error("「每日更新」未解析到条目");

  // 更新规则：按「每日更新」7 天 Tab 排期推导（如「每周二、四更新」/「每日更新」）；
  // 已完结剧集不生成规则（避免把一次性放送误写成周更）
  const rulesByTitle = weeklyRuleFor(items);
  for (const it of items) {
    if (it.rule) continue;
    if (FINISHED_RE.test(`${it.episode ?? ""} ${it.badge ?? ""}`)) continue;
    const r = rulesByTitle.get(it.title);
    if (r) it.rule = r;
  }

  const deduped = dedupSvip(items, log);
  await enrichDurations(deduped, { fetchLimit, log });

  return { platform: PLATFORM, label: LABEL, items: deduped, fetchedAt: new Date().toISOString(), warnings: [] };
}

/**
 * tab.date 形如 "07.27"；返回当年对应日期。
 * 无法解析时按「今/今天」tab 锚定北京今天推算其余星期（不依赖周一索引，
 * 避免今天≠周一时错位——优酷今天 tab 曾反复回归的根因）。
 */
function tabDate(dateStr, d, tabs) {
  const m = String(dateStr ?? "").match(/(\d{2})\.(\d{2})/);
  if (m) {
    const now = new Date();
    const year = now.getFullYear();
    const date = new Date(year, Number(m[1]) - 1, Number(m[2]));
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }
  const todayIdx = (tabs ?? []).findIndex((t) => /^今/.test(String(t.title ?? "")));
  const anchor = todayIdx >= 0 ? todayIdx : 0;
  const now = new Date(Date.now() + 8 * 3600 * 1000);
  const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const target = new Date(base);
  target.setUTCDate(base.getUTCDate() + (d - anchor));
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}-${String(target.getUTCDate()).padStart(2, "0")}`;
}

/** SVIP 抢先去重：保留 SVIP 抢先日，删除后一天同标题同集常规条目 */
function dedupSvip(items, log) {
  const byShow = new Map();
  for (const it of items) {
    const key = `${it.title}:${it.episode}`;
    if (!byShow.has(key)) byShow.set(key, []);
    byShow.get(key).push(it);
  }
  const remove = new Set();
  for (const group of byShow.values()) {
    if (group.length < 2) continue;
    const svipDays = group.filter((i) => i.svip);
    if (!svipDays.length) continue;
    for (const svipIt of svipDays) {
      for (const other of group) {
        if (other !== svipIt && !other.svip && other.date > svipIt.date) remove.add(other);
      }
    }
  }
  if (remove.size) {
    log(`SVIP 抢先去重：移除 ${remove.size} 条常规条目`);
    return items.filter((i) => !remove.has(i));
  }
  return items;
}

/**
 * 从 show_page HTML 提取时长（秒）：
 * - 支持数值秒（含小数，如 "duration":174.04）、数值毫秒（duration_msec / ≥300000 视为毫秒）、
 *   ISO 8601（"PT5M49.5S" / "PT1H2M3S"）；
 * - 页面字段较多时取最大值（通常是正片集时长；AI 漫剧单集可不足 1 分钟）。
 */
export function extractDurations(html) {
  const raw = [
    ...[...html.matchAll(/"duration"\s*:\s*(\d+(?:\.\d+)?)/g)],
    ...[...html.matchAll(/"videoDuration"\s*:\s*(\d+(?:\.\d+)?)/g)],
    ...[...html.matchAll(/"duration_msec"\s*:\s*(\d+(?:\.\d+)?)/g)],
  ].map((m) => Number(m[1]));
  for (const m of html.matchAll(/"duration"\s*:\s*"PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?"/g)) {
    if (!m[1] && !m[2] && !m[3]) continue;
    raw.push((m[1] ? Number(m[1]) * 3600 : 0) + (m[2] ? Number(m[2]) * 60 : 0) + (m[3] ? Number(m[3]) : 0));
  }
  if (!raw.length) return null;
  const max = Math.max(...raw);
  if (max >= 300000) return Math.round(max / 1000); // 毫秒字段（≥5 分钟）
  return max >= 1 ? Math.round(max * 100) / 100 : null;
}

/** show_page 内联总集数（如 "episodeTotal":129） */
export function extractEpisodeTotal(html) {
  const m = String(html ?? "").match(/"episodeTotal"\s*:\s*(\d+)/);
  const n = m ? Number(m[1]) : null;
  return n && n > 0 ? n : null;
}

/**
 * 时长富集：show_page 页面内联时长。
 * 反爬对策（2026-08 实测：连续请求约 3~5 次后 show_page 返回 _____tmd_____/punish 挑战页）：
 * 1) 慢速（1.2s）请求 + 命中挑战页后长冷却重试；
 * 2) 挑战页带出真实 videoId（v_show/id_xxx），转播放页兜底；
 * 3) 首轮失败者冷却后二次重试；
 * 4) 仍失败者走 Playwright 浏览器加载（CI 已装 chromium），执行挑战后取完整 HTML。
 */
async function enrichDurations(items, { fetchLimit, log }) {
  const results = new Map();
  const totals = new Map();
  const uniq = [...new Map(items.map((i) => [i.title, i])).values()].slice(0, Math.max(fetchLimit, 80));
  const failed = [];
  for (const it of uniq) {
    let dur = null;
    let realVid = null;
    try {
      const pageHtml = await fetchShowPage(it.url, log);
      dur = extractDurations(pageHtml);
      const tot = extractEpisodeTotal(pageHtml);
      if (tot != null) totals.set(it.title, tot);
    } catch (err) {
      realVid = err?.realVid ?? null;
      log(`show_page 富集失败 ${it.title}: ${err.message}`);
    }
    // 播放页兜底：优先挑战页带出的真实 videoId，其次条目 previewInfo.videoId（预览短片，仅作兜底）
    if (dur == null) {
      const vid = realVid ?? it.videoId;
      if (vid) {
        try {
          dur = await fetchPlayerDuration(vid);
        } catch (err) {
          log(`播放页兜底失败 ${it.title}: ${err.message}`);
        }
      }
    }
    results.set(it.title, dur ?? null);
    if (dur == null) failed.push(it);
    await sleep(1200);
  }

  if (failed.length) {
    log(`首轮 ${failed.length} 条未取到时长，冷却 12s 后二次重试…`);
    await sleep(12000);
    for (const it of failed) {
      if (results.get(it.title) != null) continue;
      try {
        const pageHtml = await fetchShowPage(it.url, log);
        const d = extractDurations(pageHtml);
        if (d != null) results.set(it.title, d);
        const t = extractEpisodeTotal(pageHtml);
        if (t != null) totals.set(it.title, t);
      } catch (err) {
        log(`二次重试失败 ${it.title}: ${err.message}`);
      }
      await sleep(1500);
    }
  }

  const stillMissing = uniq.filter((it) => results.get(it.title) == null);
  if (stillMissing.length) {
    log(`仍缺时长 ${stillMissing.length} 条，启动浏览器兜底…`);
    await enrichViaBrowser(stillMissing, results, totals, log);
  }

  for (const it of items) {
    const dur = results.get(it.title);
    if (dur !== undefined) it.duration = dur;
    const tot = totals.get(it.title);
    if (tot !== undefined) it.total = tot;
  }
  const okCount = [...results.values()].filter((v) => v != null).length;
  log(`时长富集完成：尝试 ${uniq.length} 部，成功 ${okCount} 部`);
}

/** Playwright 浏览器兜底：真实浏览器执行反爬挑战后取完整 HTML（CI 已安装 chromium） */
async function enrichViaBrowser(items, results, totals, log) {
  let browser;
  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({ userAgent: UA, locale: "zh-CN", viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    for (const it of items) {
      if (results.get(it.title) != null) continue;
      try {
        await page.goto(it.url, { waitUntil: "domcontentloaded", timeout: 35000 });
        await page.waitForFunction(() => document.documentElement.outerHTML.length > 50000, null, { timeout: 25000 }).catch(() => {});
        await page.waitForTimeout(1500);
        const html = await page.evaluate(() => document.documentElement.outerHTML);
        const dur = extractDurations(html);
        const tot = extractEpisodeTotal(html);
        if (dur != null) results.set(it.title, dur);
        if (tot != null) totals.set(it.title, tot);
        if (dur != null || tot != null) log(`浏览器兜底成功 ${it.title}: ${dur ?? "-"}s 共${tot ?? "-"}话`);
        else log(`浏览器兜底无时长/总集数字段 ${it.title}`);
      } catch (err) {
        log(`浏览器兜底失败 ${it.title}: ${err.message}`);
      }
      await page.waitForTimeout(1200);
    }
  } catch (err) {
    log(`浏览器兜底不可用：${err.message}`);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

/** 解析 "MM:SS" / "HH:MM:SS" / 秒数 为秒 */
function parseDurText(input) {
  if (input === null || input === undefined || input === "") return null;
  if (typeof input === "number" && Number.isFinite(input)) return Math.round(input);
  const text = String(input).trim();
  if (/^\d+(\.\d+)?$/.test(text)) return Math.round(Number(text));
  const m = text.match(/^(?:(\d{1,3}):)?([0-5]?\d):([0-5]\d)$/);
  return m ? Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}

/** 播放页兜底：v_show/id_{videoId}.html 的 __INITIAL_DATA__.pageMap.extra.duration（概率性风控，最多 4 次重试） */
async function fetchPlayerDuration(videoId) {
  const url = `https://v.youku.com/v_show/id_${encodeURIComponent(videoId)}.html`;
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const html = await fetchText(url, { referer: "https://www.youku.com/", timeout: 15000 });
      // 风控页（_____tmd_____/punish）短小且无 __INITIAL_DATA__：重试只会加重风控，直接失败
      if (html.length < 10000 || html.includes("_____tmd_____")) {
        throw new Error("播放页命中风控");
      }
      const dataText = extractAssignedObject(html, "__INITIAL_DATA__");
      if (!dataText) throw new Error("播放页无 __INITIAL_DATA__（风控变种页）");
      const data = parseJsObject(dataText);
      const dur = parseDurText(data?.pageMap?.extra?.duration);
      if (dur != null && dur > 0) return dur;
      throw new Error("播放页 extra 无时长");
    } catch (err) {
      lastErr = err;
      // 风控页重试无益，提前结束
      if (/风控/.test(String(err.message))) break;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
    }
  }
  throw lastErr ?? new Error("播放页时长获取失败");
}

/** show_page 抓取：失败或命中反爬挑战页时冷却重试；挑战页带出真实 videoId 供播放页兜底 */
async function fetchShowPage(url, log = () => {}) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const html = await fetchText(url, { referer: "https://www.youku.com/ku/webcomic", timeout: 20000 });
      if (html.length > 10000 && !html.includes("_____tmd_____")) return html;
      const err = new Error("页面命中反爬挑战");
      err.realVid = html.match(/v_show\/id_([A-Za-z0-9=]+)/)?.[1] ?? null;
      throw err;
    } catch (err) {
      lastErr = err;
    }
    log(`show_page 命中反爬挑战（第 ${attempt + 1} 次），冷却 ${8 + attempt * 4}s 后重试`);
    await sleep((8 + attempt * 4) * 1000);
  }
  throw lastErr ?? new Error("show_page 抓取失败");
}
