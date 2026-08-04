/**
 * 爱奇艺动漫周更抓取（Playwright，计划 §3.4）
 * 入口：https://www.iqiyi.com/dongman/，逐日点击星期 tab 收集日历卡片。
 */
import { chromium } from "playwright";
import { addDays, createCache, httpsImg, isBlocked, mondayOfWeekBeijing, weeklyRuleFor, ymd } from "./shared.mjs";

export const PLATFORM = "iqiyi";
export const LABEL = "爱奇艺";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const WEEKDAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const INVALID_TEXT_RE = /即将上线|敬请期待|马上看|预约|限时/;
const FINISHED_RE = /(大结局|完结|已完结|全\s*\d+\s*(集|话)|\d+\s*(集|话)\s*全)/;
/**
 * 频道数据接口（页面 SPA 同源数据，返回 7 个星期分组，无需点击 tab）。
 * 用 v7（mesh.if.iqiyi.com）：卡片 desc 带更新规则文本（如「每周二09:00免费更新1集」），
 * 可解析更新时间；v5（prelw…v5）同名接口无 desc 时间字段。
 */
const CHANNEL_API =
  "https://mesh.if.iqiyi.com/portal/lw/v7/channel/cartoon?uid=0&vip=0&auth=&v=17.074.25935&width=1440&platformcode=b6c13e26323c537d";
const BLOCK_WD = { jmd_Mon: 1, jmd_Tues: 2, jmd_Wed: 3, jmd_Thur: 4, jmd_Fri: 5, jmd_Sat: 6, jmd_Sun: 7 };
const WK_NUM = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7, 末: 6 };

/** 规则文案 → 该星期对应的更新时间（如「每周二、六10：00各更新一集」+ 周六 → 10:00；无匹配取首个时间） */
export function updateTimeOf(desc, weekday) {
  const t = String(desc ?? "");
  for (const m of t.matchAll(/每?周([一二三四五六日天末])([^。；;0-9]{0,6}?)(\d{1,2})[:：点](\d{2})?/g)) {
    const days = new Set([WK_NUM[m[1]]]);
    for (const ch of m[2]) {
      const w = WK_NUM[ch];
      if (w) days.add(w);
    }
    if (days.has(weekday)) {
      return `${String(Number(m[3])).padStart(2, "0")}:${(m[4] ?? "00").padStart(2, "0")}`;
    }
  }
  const fallback = t.match(/([01]?\d|2[0-3])[:：点](\d{2})?/);
  return fallback ? `${String(Number(fallback[1])).padStart(2, "0")}:${(fallback[2] ?? "00").padStart(2, "0")}` : "";
}

/** 毫秒时间戳 → 北京 HH:MM（爱奇艺 avlistinfo issueTime 用） */
export function fmtHmBeijing(ms) {
  const d = new Date(Number(ms) + 8 * 3600 * 1000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** 卡片原文更新规则：截取「每周X…更新」片段并规整（如「每周二、六10：00各更新一集」→「每周二、六10：00更新」） */
function ruleOf(text) {
  const m = String(text ?? "").match(/每[周日天][^，。；;]{0,36}?更新/);
  if (!m) return null;
  const s = m[0].replace(/(?:免费|会员|抢先看)?\s*各?更新\s*[0-9一二两三四五六七八九十]*\s*集?$/, "更新").trim();
  return s.length >= 3 && s.length <= 40 ? s : null;
}

export async function scrape({ fetchLimit = 40, log = () => {} } = {}) {
  // 接口优先：一次性取回 7 个星期分组，彻底规避「今天 tab 重复点击/虚拟化缺渲染」类回归；
  // 接口结构变化时回退浏览器逐日点击。
  try {
    const items = await scrapeViaChannelApi({ log });
    // v7 接口 desc 为 A/B 下发（命中率低）：缺更新时间时用浏览器对星期卡片补时（失败留空）
    await enrichUpdateTimes(items, { log });
    return await finalizeIqiyi(items, { fetchLimit, log });
  } catch (err) {
    log(`频道接口不可用，回退浏览器抓取：${err.message}`);
    return scrapeViaBrowser({ fetchLimit, log });
  }
}

/** 浏览器补时：逐日读取追番表卡片文本，为缺失 updateTime 的条目解析「每周X HH:MM」 */
async function enrichUpdateTimes(items, { log = () => {} } = {}) {
  const missing = items.filter((i) => !i.updateTime);
  if (!missing.length) return;
  let browser;
  let overlayTimer;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage({ viewport: { width: 1440, height: 1400 }, userAgent: UA });
    await page.goto("https://www.iqiyi.com/dongman/", { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(5000);
    dismissOverlay(page);
    overlayTimer = setInterval(() => dismissOverlay(page), 800);
    await page.evaluate(() => {
      const el = document.querySelector("[class*=videoCards_tab_btn]");
      if (el) el.scrollIntoView({ block: "center" });
    });
    await page.waitForTimeout(1200);

    const tabLoc = page.locator("[class*=videoCards_tab_btn]");
    const descByDay = new Map();
    const norm = (t) => String(t).replace(/[\s·．:：]/g, "").toLowerCase();
    for (let d = 0; d < 7; d++) {
      const label = WEEKDAYS[d];
      const tab = tabLoc.filter({ hasText: label }).first();
      if (!(await tab.count())) continue;
      const isActive = await tab.evaluate((el) => /active/.test(el.className || "")).catch(() => false);
      if (!isActive) {
        await clickTab(page, tab);
        await page.waitForTimeout(1200);
        dismissOverlay(page);
        // 确认切换成功，避免把上一日残留卡片误映射到当前星期
        const nowActive = await tab.evaluate((el) => /active/.test(el.className || "")).catch(() => false);
        if (!nowActive) {
          log(`补时跳过 ${label}（tab 切换未生效）`);
          continue;
        }
      }
      const cards = await readIqiyiCards(page);
      if (cards.length) descByDay.set(d + 1, new Map(cards.map((c) => [norm(c.title), c.text])));
    }
    let hit = 0;
    for (const it of missing) {
      const text = descByDay.get(it.weekday)?.get(norm(it.title));
      if (text) {
        const t = updateTimeOf(text, it.weekday);
        if (t) {
          it.updateTime = t;
          hit++;
        }
        // 有原文规则（含时间）时优先使用，未完结剧的最终清理在 finalizeIqiyi 完成
        it.rule = ruleOf(text) ?? it.rule;
      }
    }
    log(`浏览器补时：${hit}/${missing.length} 条`);
  } catch (err) {
    log(`浏览器补时不可用（保持空时间）：${err.message}`);
  } finally {
    if (overlayTimer) clearInterval(overlayTimer);
    if (browser) await browser.close().catch(() => {});
  }
}

/** 频道接口抓取：解析 v7 JSON 中的追番表模块（jmd_Mon~Sun 7 组） */
async function scrapeViaChannelApi({ log = () => {} } = {}) {
  const res = await fetch(CHANNEL_API, {
    headers: { "user-agent": UA, referer: "https://www.iqiyi.com/dongman/", accept: "application/json, text/plain, */*" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`channel API HTTP ${res.status}`);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("channel API 响应非 JSON");
  }
  const mod = (data?.items ?? []).find((it) => it.title === "追番表");
  const groups = mod?.video ?? [];
  if (!Array.isArray(groups) || !groups.length) throw new Error("追番表模块缺失");

  const monday = mondayOfWeekBeijing();
  const now = new Date(Date.now() + 8 * 3600 * 1000);
  const todayWd = ((now.getUTCDay() + 6) % 7) + 1;
  const todayBlock = Object.keys(BLOCK_WD).find((k) => BLOCK_WD[k] === todayWd);
  const dayGroups = groups.filter((g) => BLOCK_WD[g.block_id] && (g.data?.length ?? 0) > 0);
  const todayGroup = groups.find((g) => g.block_id === todayBlock);
  if (dayGroups.length < 5 || !todayGroup?.data?.length) {
    throw new Error(`星期分组不完整（${dayGroups.length} 组，今天=${todayBlock}）`);
  }

  const items = [];
  const seen = new Set();
  for (const g of groups) {
    const weekday = BLOCK_WD[g.block_id];
    if (!weekday) continue;
    const date = ymd(addDays(monday, weekday - 1));
    for (const c of g.data ?? []) {
      const title = String(c.title ?? "").trim();
      if (!title) continue;
      const epStatus = String(c.dq_updatestatus ?? "").trim();
      // 未开播/预约卡片无集数状态（如「成也萧河」），跳过
      if (!epStatus || INVALID_TEXT_RE.test(`${epStatus} ${title}`)) continue;
      const key = `${date}:${title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const epMatch = epStatus.match(/更新至\s*(\d+)\s*(集|话)/);
      items.push({
        id: `iqiyi-${date}-${title}`,
        platform: PLATFORM,
        title,
        poster: httpsImg(c.image_url_normal || c.image_cover || c.album_image_url_hover),
        episode: epMatch ? `第${epMatch[1]}${epMatch[2]}` : epStatus,
        updateTime: updateTimeOf(c.desc, weekday),
        date,
        weekday,
        svip: false,
        url: String(c.page_url ?? ""),
        badge: null,
        albumId: c.album_id != null ? String(c.album_id) : null,
        tvId: c.tv_id != null ? String(c.tv_id) : null,
        rule: ruleOf(c.desc),
        duration: null,
      });
    }
  }
  if (!items.length) throw new Error("频道接口无有效条目");
  log(`频道接口抓取成功：${items.length} 条（7 个星期分组）`);
  return items;
}

/** 公共收尾：更新规则 + 时长/总集数富集 + AI 短剧评论判定 */
async function finalizeIqiyi(items, { fetchLimit, log }) {
  const rulesByTitle = weeklyRuleFor(items);
  for (const it of items) {
    if (FINISHED_RE.test(`${it.episode ?? ""} ${it.badge ?? ""}`)) {
      delete it.rule;
      continue;
    }
    if (it.rule) continue;
    const r = rulesByTitle.get(it.title);
    if (r) it.rule = r;
  }
  await enrichDurations(items, { fetchLimit, log });
  const filtered = await classifyAiShorts(items, { fetchLimit, log });
  if (filtered.length !== items.length) log(`AI 短剧评论判定过滤：${items.length - filtered.length} 条`);
  return { platform: PLATFORM, label: LABEL, items: filtered, fetchedAt: new Date().toISOString(), warnings: [] };
}

/** 浏览器抓取（接口不可用时的兜底）：逐日点击星期 tab 收集日历卡片 */
async function scrapeViaBrowser({ fetchLimit = 40, log = () => {} } = {}) {
  let browser;
  let overlayTimer;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage({ viewport: { width: 1440, height: 1400 }, userAgent: UA });
    await page.goto("https://www.iqiyi.com/dongman/", { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(5000);
    dismissOverlay(page);
    // 登录/推荐弹窗会周期性出现并拦截点击：定时清除
    overlayTimer = setInterval(() => dismissOverlay(page), 800);
    // 「追番表」模块懒加载：滚动到星期 tab 栏触发渲染（避免激活日读空）
    await page.evaluate(() => {
      const el = document.querySelector("[class*=videoCards_tab_btn]");
      if (el) el.scrollIntoView({ block: "center" });
    });
    await page.waitForTimeout(1200);

    const tabLoc = page.locator("[class*=videoCards_tab_btn]");
    const monday = mondayOfWeekBeijing();
    const items = [];
    const seen = new Set();

    for (let d = 0; d < 7; d++) {
      const label = WEEKDAYS[d];
      const tab = tabLoc.filter({ hasText: label }).first();
      if (!(await tab.count())) continue;
      // 当天 tab 默认已激活：重复点击会触发重新加载导致卡片清空（周一/周日缺数据的根因）
      const isActive = await tab.evaluate((el) => /active/.test(el.className || "")).catch(() => false);
      const readCards = () => readIqiyiCards(page);

      let cards;
      if (isActive) {
        // 当天默认已加载：直接读取；为空时滚动+等待多次重试（禁止直接 force 点击激活 tab，
        // 历史根因：重复点击激活 tab 触发重新加载清空卡片）
        cards = await readCards();
        for (let attempt = 0; attempt < 4 && !cards.length; attempt++) {
          await page.waitForTimeout(1200);
          await page.evaluate(() => {
            window.scrollBy(0, 280);
            document.querySelector("[class*=followCalendarCard]")?.scrollIntoView({ block: "center" });
          }).catch(() => {});
          dismissOverlay(page);
          cards = await readCards();
        }
        if (!cards.length) {
          // 兜底：先切到其他星期再切回目标日（避免对激活 tab 直接 force 点击）
          await switchAwayAndBack(page, tabLoc, d);
          cards = await readCards();
          if (!cards.length) log(`${label} 兜底切换后仍无卡片`);
        }
      } else {
        await clickTab(page, tab);
        await page.waitForTimeout(1500);
        dismissOverlay(page);
        cards = await readCards();
        if (!cards.length) {
          // 懒加载未完成：滚动触发 + 重试一次
          await page.evaluate(() => window.scrollBy(0, 260));
          await page.waitForTimeout(2500);
          cards = await readCards();
          if (!cards.length) {
            // 同样走「切走再切回」恢复（部分变体点击后首次渲染为空）
            await switchAwayAndBack(page, tabLoc, d);
            cards = await readCards();
          }
        }
      }

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
          updateTime: updateTimeOf(c.text, weekday),
          date,
          weekday,
          svip: false,
          url: c.url ? httpsImg(c.url) : "",
          badge: null,
          rule: ruleOf(c.text),
          duration: null,
        });
      }
    }

    if (!items.length) throw new Error("未解析到任何周更卡片");
    return finalizeIqiyi(items, { fetchLimit, log });
  } finally {
    if (overlayTimer) clearInterval(overlayTimer);
    if (browser) await browser.close().catch(() => {});
  }
}

/** 读取「追番表」日历卡片：优先 followCalendarCard 容器；A/B 变体回退排除「猜你喜欢」推荐区 */
export async function readIqiyiCards(page) {
  return page.evaluate(() => {
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
  const uniq = [...new Map(items.map((i) => [albumKeyOf(i), i])).values()];
  let fetched = 0;
  for (const it of uniq) {
    const aid = albumKeyOf(it);
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
    const aid = albumKeyOf(it);
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
    if (r.total != null) it.total = r.total;
    // 更新时间兜底：desc 规则文本缺失时取最新正片 issueTime（北京时间 HH:MM，CI 也可用）
    if (!it.updateTime && r.latestIssueTime != null) it.updateTime = fmtHmBeijing(r.latestIssueTime);
  }
  log(`时长富集完成：抓取 ${fetched} 专辑，命中 ${hit}/${items.length} 条`);
}

/** 专辑 ID：接口路径直接带 album_id；DOM 路径从卡片 URL 的 album_id（base64）解码 */
function albumKeyOf(it) {
  return it.albumId ?? albumOf(it.url) ?? it.title;
}

/**
 * 拉取专辑全部分集（分页 200/页，最多 3 页覆盖年番），返回 { byDur, byUrl, latestDur, latestUrl, total, latestIssueTime }。
 * 只保留正片：优先按 contentType===1 过滤（部分专辑末尾会混入预告/片花/PV），
 * contentType 缺失时按「第N集/话」标题兜底，避免把预告当作最新集。
 */
async function fetchAlbumDurations(aid) {
  const byDur = new Map();
  const byUrl = new Map();
  let latestDur = null;
  let latestUrl = null;
  let total = null;
  let latestIssueTime = null;
  for (let page = 1; page <= 3; page++) {
    const res = await fetch(`https://pcw-api.iqiyi.com/albums/album/avlistinfo?aid=${encodeURIComponent(aid)}&page=${page}&size=200`, {
      headers: { "user-agent": UA, referer: "https://www.iqiyi.com/", accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`avlistinfo HTTP ${res.status}`);
    const j = await res.json().catch(() => null);
    if (!j || j.code !== "A00000") throw new Error("avlistinfo 响应异常");
    const t = Number(j.data?.total);
    if (Number.isFinite(t) && t > 0) total = t;
    const list = (j.data?.epsodelist ?? []).filter((e) => {
      if (e.contentType != null && e.contentType !== "") return String(e.contentType) === "1";
      return /第\s*\d+\s*(集|话)/.test(String(e.name ?? ""));
    });
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
      const issue = Number(ep.issueTime);
      if (Number.isFinite(issue) && issue > 0) latestIssueTime = issue;
    }
    if (list.length < 200) break;
  }
  if (!byDur.size) throw new Error("分集列表无时长字段");
  return { byDur, byUrl, latestDur, latestUrl, total, latestIssueTime };
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
    const tvId = it.tvId ?? tvOf(it.url);
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
    document.querySelectorAll("[class*=fullCover], [class*=popwin], [class*=popup], [class*=modal]").forEach((el) => el.remove());
  }).catch(() => {});
}

/** 点击星期 tab：清除遮罩后点击，失败 force 重试（弹窗拦截时兜底） */
async function clickTab(page, tab) {
  for (let i = 0; i < 3; i++) {
    dismissOverlay(page);
    try {
      await tab.click({ timeout: 5000 });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 600));
      dismissOverlay(page);
      try {
        await tab.click({ force: true, timeout: 5000 });
        return;
      } catch {
        /* 最后一轮重试 */
      }
    }
  }
}

/** 切到其他星期再切回目标日：用于激活日读空/点击后未渲染时的恢复 */
async function switchAwayAndBack(page, tabLoc, d) {
  const count = await tabLoc.count().catch(() => 0);
  const other = count > 1 ? tabLoc.nth((d + 1) % count) : null;
  if (other) {
    await clickTab(page, other).catch(() => {});
    await page.waitForTimeout(1500);
    dismissOverlay(page);
  }
  await clickTab(page, tabLoc.nth(d));
  await page.waitForTimeout(1800);
  dismissOverlay(page);
}
