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
    const monday = addDays(new Date(today.getFullYear(), today.getMonth(), today.getDate()), -(((today.getDay() + 6) % 7)));
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
    await enrichDurations(items, { fetchLimit, log });
    const filtered = await classifyAiShorts(items, { fetchLimit, log });
    if (filtered.length !== items.length) log(`AI 短剧评论判定过滤：${items.length - filtered.length} 条`);
    return { platform: PLATFORM, label: LABEL, items: filtered, fetchedAt: new Date().toISOString(), warnings: [] };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

/** 卡片 URL 中的 album_id（base64）解码为数字专辑 ID */
function albumOf(url) {
  const m = String(url ?? "").match(/album_id=([^&]+)/);
  return m ? Buffer.from(decodeURIComponent(m[1]), "base64").toString("utf8") : null;
}

/** 卡片 URL 中的 tv_id（base64）解码为数字视频 id（评论区 content_id 用） */
function tvOf(url) {
  const m = String(url ?? "").match(/tv_id=([^&]+)/);
  return m ? Buffer.from(decodeURIComponent(m[1]), "base64").toString("utf8") : null;
}

/** 解析多种时长格式为秒：爱奇艺 avlistinfo 返回 "MM:SS" / "HH:MM:SS" / 秒数 */
function parseDur(input) {
  if (input === null || input === undefined || input === "") return null;
  if (typeof input === "number" && Number.isFinite(input)) return Math.round(input);
  const text = String(input).trim();
  if (/^\d+(\.\d+)?$/.test(text)) return Math.round(Number(text));
  const m = text.match(/^(?:(\d{1,3}):)?([0-5]?\d):([0-5]\d)$/);
  return m ? Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}

/** 条目集数文本 → 数字（"第202集"/"14集全" → 202/14；"Ⅱ-3" 等无法解析返回 null） */
function epNum(episode) {
  const m = String(episode ?? "").match(/(\d+)\s*集/);
  return m ? Number(m[1]) : null;
}

/**
 * 富集：专辑分集接口 avlistinfo（稳定）返回每集真实时长与正片 playUrl，
 * 替代卡片链接（多为 PV/预告）带来的不可靠时长与跳转；条目 URL 修正为该集正片直达。
 */
async function enrichDurations(items, { fetchLimit, log }) {
  const cache = createCache();
  const uniq = [...new Map(items.map((i) => [albumOf(i.url) ?? i.title, i])).values()];
  let fetched = 0;
  for (const it of uniq) {
    const aid = albumOf(it.url) ?? it.title;
    if (cache.get(aid) !== undefined) continue;
    if (fetched >= fetchLimit) break;
    fetched++;
    try {
      cache.set(aid, await fetchAlbumDurations(aid));
    } catch (err) {
      cache.set(aid, null);
      log(`时长富集失败 ${it.title}: ${err.message}`);
    }
  }
  let hit = 0;
  for (const it of items) {
    const aid = albumOf(it.url) ?? it.title;
    const r = cache.get(aid);
    if (!r) continue;
    const n = epNum(it.episode);
    const dur = (n != null ? r.byDur.get(n) : undefined) ?? r.latestDur;
    if (dur != null && dur > 0) {
      it.duration = dur;
      hit++;
    }
    const url = (n != null ? r.byUrl.get(n) : undefined) ?? r.latestUrl;
    if (url) it.url = url; // 正片直达（原卡片链接多为 PV/预告）
  }
  log(`时长富集完成：抓取 ${fetched} 专辑，命中 ${hit}/${items.length} 条`);
}

/** 拉取专辑全部分集（分页 200/页，最多 3 页覆盖年番），返回 { byDur, byUrl, latestDur, latestUrl } */
async function fetchAlbumDurations(aid) {
  const byDur = new Map();
  const byUrl = new Map();
  let latestDur = null;
  let latestUrl = null;
  for (let page = 1; page <= 3; page++) {
    const res = await fetch(`https://pcw-api.iqiyi.com/albums/album/avlistinfo?aid=${encodeURIComponent(aid)}&page=${page}&size=200`, {
      headers: { "user-agent": UA, referer: "https://www.iqiyi.com/", accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`avlistinfo HTTP ${res.status}`);
    const j = await res.json().catch(() => null);
    if (!j || j.code !== "A00000") throw new Error("avlistinfo 响应异常");
    const list = j.data?.epsodelist ?? [];
    if (!list.length) break;
    for (const ep of list) {
      const dur = parseDur(ep.duration);
      const url = ep.playUrl ? String(ep.playUrl).replace(/^http:/, "https:") : null;
      if (dur != null && dur > 0) {
        byDur.set(Number(ep.order), dur);
      }
      if (url) {
        byUrl.set(Number(ep.order), url);
        latestUrl = url; // 列表有序，最后一项即最新集
      }
      if (dur != null && dur > 0) latestDur = dur;
    }
    if (list.length < 200) break;
  }
  if (!byDur.size) throw new Error("分集列表无时长字段");
  return { byDur, byUrl, latestDur, latestUrl };
}

/** 评论区 AI 负面反馈特征：同一条评论同时含 AI 关键字与负面情绪词 */
const AI_COMMENT_RE = /AI|人工智能/;
const NEG_COMMENT_RE = /垃圾|难看|太差|烂|敷衍|粗糙|廉价|恶心|僵硬|失望|弃|退钱|骗|鬼畜|帧数|看坏|受不了|偷工减料|省成本|毁|无语|拉胯|倒胃口|低质|不行|太短|几分钟|泡面番/;

/**
 * AI 短剧分类（评论区启发式，计划外补充）：
 * 拉取剧集评论区（1 页 20 条，控制请求量避免触发限流），若存在「提及 AI 且负面情绪」的评论，判定为 AI 短剧并过滤。
 * 评论接口可能限流（403/429）或评论稀疏，失败时优雅降级保留条目。
 */
async function classifyAiShorts(items, { fetchLimit, log }) {
  const cache = createCache();
  const uniq = [...new Map(items.map((i) => [i.title, i])).values()];
  const dropped = new Set();
  let fetched = 0;
  for (const it of uniq) {
    if (cache.get(it.title) !== undefined) continue;
    // 已知时长为长剧（≥5 分钟）的跳过评论判定，避免「AI 修复/作画」类负面评论误判
    if (it.duration != null && it.duration >= 300) {
      cache.set(it.title, false);
      continue;
    }
    const tvId = tvOf(it.url);
    if (!tvId) {
      cache.set(it.title, false);
      continue;
    }
    if (fetched >= fetchLimit) break;
    fetched++;
    let aiNeg = false;
    try {
      const res = await fetch(`https://sns-comment.iqiyi.com/v3/comment/get_comments.action?content_id=${tvId}&business_type=17&agent_version=10.2&agent_type=30&page=1&page_size=20`, {
        headers: { "user-agent": UA, referer: "https://www.iqiyi.com/", accept: "application/json" },
        signal: AbortSignal.timeout(12000),
      });
      if (res.status === 403 || res.status === 429) throw new Error(`评论接口限流 HTTP ${res.status}`);
      if (!res.ok) throw new Error(`评论接口 HTTP ${res.status}`);
      const t = await res.text();
      const comments = [...t.matchAll(/"content"\s*:\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
      if (comments.some((c) => AI_COMMENT_RE.test(c) && NEG_COMMENT_RE.test(c))) {
        aiNeg = true;
      }
    } catch (err) {
      log(`AI 评论检测失败 ${it.title}: ${err.message}`);
    }
    cache.set(it.title, aiNeg);
    if (aiNeg) {
      dropped.add(it.title);
      log(`评论区 AI 负面反馈，判定为 AI 短剧：${it.title}`);
    }
  }
  return items.filter((i) => !dropped.has(i.title));
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
