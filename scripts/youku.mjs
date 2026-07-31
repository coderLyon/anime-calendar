/**
 * 优酷动漫周更抓取（SSR，计划 §3.2）
 * 入口：GET https://www.youku.com/ku/webcomic，解析 window.__INITIAL_DATA__ 的「每日更新」模块
 * （KU_FLIX_MULTI_TAB_A：tabList 7 个星期 tab + itemList 7 个数组一一对应）
 */
import { createCache, extractAssignedObject, fetchText, httpsImg, parseJsObject } from "./shared.mjs";

export const PLATFORM = "youku";
export const LABEL = "优酷";

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
        const date = tabDate(tab.date, d);
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
        // 有 videoId 时用播放页直达（最新更新集）；否则回退剧集页
        url: it.previewInfo?.videoId
          ? `https://v.youku.com/v_show/id_${it.previewInfo.videoId}.html`
          : `https://www.youku.com/show_page/id_${it.action_value}.html`,
        videoId: it.previewInfo?.videoId ?? null, // 播放页兜底用（X+base64 形式的 videoId）
        badge: it.mark?.text || it.mark?.iconfont || null,
        duration: null,
      });
    }
  }

  if (!items.length) throw new Error("「每日更新」未解析到条目");

  const deduped = dedupSvip(items, log);
  await enrichDurations(deduped, { fetchLimit, log });

  return { platform: PLATFORM, label: LABEL, items: deduped, fetchedAt: new Date().toISOString(), warnings: [] };
}

/** tab.date 形如 "07.27"；返回当年对应日期，无法解析则按当前周周一 + d */
function tabDate(dateStr, d) {
  const m = String(dateStr ?? "").match(/(\d{2})\.(\d{2})/);
  if (m) {
    const now = new Date();
    const year = now.getFullYear();
    const date = new Date(year, Number(m[1]) - 1, Number(m[2]));
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }
  const today = new Date();
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
  const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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

/** 时长富集：show_page 页面内联时长（缺失时尽力而为，失败记 warnings） */
async function enrichDurations(items, { fetchLimit, log }) {
  const cache = createCache();
  const uniq = [...new Map(items.map((i) => [i.title, i])).values()];
  let fetched = 0;
  for (const it of uniq) {
    if (cache.get(it.title) !== undefined) continue;
    if (fetched >= fetchLimit) break;
    let dur = null;
    try {
      const pageHtml = await fetchShowPage(it.url);
      const all = [
        ...[...pageHtml.matchAll(/"duration"\s*:\s*(\d+)/g)],
        ...[...pageHtml.matchAll(/"videoDuration"\s*:\s*(\d+)/g)],
        ...[...pageHtml.matchAll(/"duration_msec"\s*:\s*(\d+)/g)],
      ].map((m) => Number(m[1]));
      // ISO 8601 形式："duration":"PT0M59.47S" / "PT9M59.73000000000002S"
      for (const m of pageHtml.matchAll(/"duration"\s*:\s*"PT(?:(\d+)M)?([\d.]+)S"/g)) {
        all.push(Number(m[2]) + (m[1] ? Number(m[1]) * 60 : 0));
      }
      const max = all.length ? Math.max(...all) : 0;
      if (max >= 300000) dur = Math.round(max / 1000); // 毫秒字段（≥5 分钟）
      else if (max >= 1) dur = max; // 秒字段（AI 漫剧单集可不足 1 分钟，如 "duration":59.47）
    } catch (err) {
      log(`show_page 富集失败 ${it.title}: ${err.message}`);
    }
    // 播放页兜底：show_page 未取到时长且条目带 videoId 时，走 v_show 播放页（概率性风控，内置重试）
    if (dur == null && it.videoId) {
      try {
        dur = await fetchPlayerDuration(it.videoId);
      } catch (err) {
        log(`播放页兜底失败 ${it.title}: ${err.message}`);
      }
    }
    cache.set(it.title, dur);
    fetched++;
    // 请求间隔 400ms，降低连续请求触发优酷降级（缺字段/限流）的概率
    await new Promise((r) => setTimeout(r, 400));
  }
  for (const it of items) {
    const dur = cache.get(it.title);
    if (dur !== undefined) it.duration = dur;
  }
  log(`时长富集完成：抓取 ${fetched} 页`);
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

/** show_page 抓取：失败或缺少时长字段时退避重试（优酷对连续请求偶发限流/缺字段） */
async function fetchShowPage(url) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const html = await fetchText(url, { referer: "https://www.youku.com/ku/webcomic", timeout: 15000 });
      if (/duration/.test(html)) return html;
      // 风控页无 duration 且短小：重试只会加重风控，立即失败
      if (html.length < 10000 || html.includes("_____tmd_____")) throw new Error("页面命中风控");
      throw new Error("页面缺少 duration 字段");
    } catch (err) {
      lastErr = err;
    }
    // 风控/降级响应重试无益，提前结束
    if (/风控/.test(String(lastErr.message))) break;
    if (attempt < 2) await new Promise((r) => setTimeout(r, 900 * (attempt + 1)));
  }
  throw lastErr ?? new Error("show_page 抓取失败");
}
