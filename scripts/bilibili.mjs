/**
 * 哔哩哔哩国创周更抓取（SSR，计划 §3.1）
 * 入口：GET https://www.bilibili.com/guochuang/，解析 window.__INITIAL_STATE__.modules.ext[]
 */
import {
  addDays,
  createCache,
  extractAssignedObject,
  fetchText,
  httpsImg,
  isBlocked,
  mondayOfWeekBeijing,
  normUrl,
  parseJsObject,
  ymd,
  ymdBeijing,
} from "./shared.mjs";

export const PLATFORM = "bili";
export const LABEL = "哔哩哔哩";

export async function scrape({ fetchLimit = 40, log = () => {} } = {}) {
  const html = await fetchText("https://www.bilibili.com/guochuang/", { referer: "https://www.bilibili.com/" });
  const stateText = extractAssignedObject(html, "__INITIAL_STATE__");
  if (!stateText) throw new Error("页面结构变化：未找到 window.__INITIAL_STATE__");
  const state = parseJsObject(stateText);
  const modules = state?.modules?.ext;
  if (!Array.isArray(modules)) throw new Error("页面结构变化：modules.ext 缺失");

  const items = [];
  const seen = new Set();
  const weekMonday = mondayOfWeekBeijing();

  for (const mod of modules) {
    for (const dayItem of mod.items ?? []) {
      if (!Array.isArray(dayItem.episodes)) continue;
      const dow = Number(dayItem.day_of_week);
      if (!(dow >= 1 && dow <= 7)) continue; // day_of_week===0 为“最近更新”聚合组，跳过
      for (const ep of dayItem.episodes) {
        const dedupKey = `${ep.season_id ?? ""}:${ep.pub_index ?? ""}:${ep.pub_ts ?? ""}`;
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);
        const date =
          ep.pub_ts && ep.pub_ts > 0 ? ymdBeijing(new Date(ep.pub_ts * 1000)) : ymd(addDays(weekMonday, dow - 1));
        const url = ep.link ? normUrl(ep.link) : `https://www.bilibili.com/bangumi/play/ep${ep.episode_id}`;
        items.push({
          id: `bili-${ep.episode_id}`,
          platform: PLATFORM,
          title: String(ep.title ?? "").trim(),
          poster: httpsImg(ep.square_cover || ep.cover || ep.ep_cover),
          episode: String(ep.pub_index ?? ""),
          updateTime: String(ep.pub_time ?? "").slice(0, 5),
          date,
          weekday: dow,
          svip: false,
          url,
          seasonId: String(ep.season_id ?? ""), // 季分集时长接口用
          badge: ep.rating ? String(ep.rating) : null,
          duration: null, // 由时长富集填充
        });
      }
    }
  }

  if (!items.length) throw new Error("未解析到任何排期条目");

  const latestIds = await enrichDurations(items, { fetchLimit, log });
  // 黑名单/季页兜底：排期条目命中非正剧关键词（预告/小课堂等）或 URL 落到季页（ss 合集）时，
  // 回退为该季最新正片（badge≠预告）的 ep 直达链接。
  for (const it of items) {
    if ((isBlocked(`${it.title} ${it.episode}`) || /\/ss\d+/.test(it.url)) && latestIds.has(it.seasonId)) {
      it.url = `https://www.bilibili.com/bangumi/play/ep${latestIds.get(it.seasonId)}`;
    }
  }

  return { platform: PLATFORM, label: LABEL, items, fetchedAt: new Date().toISOString(), warnings: [] };
}

/**
 * 时长富集：季分集接口 api.bilibili.com/pgc/view/web/season 一次返回整季各集时长（毫秒），
 * 按 episode_id 匹配；匹配不到用该季最新集时长兜底（参考 anime-duration-api 方案）。
 */
async function enrichDurations(items, { fetchLimit, log }) {
  const cache = createCache();
  const latestIds = new Map();
  const uniq = [...new Map(items.filter((i) => i.seasonId).map((i) => [i.seasonId, i])).values()];
  let fetched = 0;
  for (const it of uniq) {
    if (cache.get(it.seasonId) !== undefined) continue;
    if (fetched >= fetchLimit) break;
    try {
      const r = await fetchSeasonDurations(it.seasonId);
      cache.set(it.seasonId, r);
      if (r.latestId) latestIds.set(it.seasonId, r.latestId);
    } catch (err) {
      cache.set(it.seasonId, null);
      log(`时长富集失败 ${it.title}: ${err.message}`);
    }
    fetched++;
  }
  let hit = 0;
  for (const it of items) {
    if (!it.seasonId) continue;
    const r = cache.get(it.seasonId);
    if (!r) continue;
    // 封面统一为该季官方封面（square_cover/cover），避免个别条目取到剧集帧/错误图
    if (r.cover) it.poster = httpsImg(r.cover);
    const epId = String(it.id.replace(/^bili-/, ""));
    const dur = r.byEp.get(epId) ?? r.latest;
    if (dur != null && dur > 0) {
      it.duration = dur;
      hit++;
    }
  }
  log(`时长富集完成：抓取 ${fetched} 季，命中 ${hit}/${items.length} 条`);
  return latestIds;
}

/** 季分集时长：返回 { byEp, latest, latestId, cover }；badge=预告 的条目同样可取时长 */
async function fetchSeasonDurations(seasonId) {
  const text = await fetchText(`https://api.bilibili.com/pgc/view/web/season?season_id=${encodeURIComponent(seasonId)}`, {
    referer: "https://www.bilibili.com/",
    timeout: 15000,
  });
  const j = JSON.parse(text);
  if (!j || j.code !== 0) throw new Error(`season API code ${j?.code ?? "?"}`);
  // 响应体可能是 data（新结构）或 result（当前结构），兼容两者
  const payload = j.result ?? j.data ?? {};
  const eps = payload.episodes ?? payload.sections?.flatMap((s) => s.episodes ?? []) ?? [];
  const byEp = new Map();
  let latest = null;
  let latestId = null;
  for (const ep of eps) {
    const ms = Number(ep.duration);
    if (Number.isFinite(ms) && ms > 0) {
      const sec = Math.round(ms / 1000);
      if (ep.id) byEp.set(String(ep.id), sec);
      // 兜底取「正片最新集」时长，避免命中末尾 PV/预告（badge=预告）
      if (ep.badge !== "预告") {
        latest = sec;
        latestId = ep.id ?? latestId;
      }
    }
  }
  if (!byEp.size) throw new Error("季分集无时长字段");
  return { byEp, latest, latestId, cover: payload.cover ?? payload.square_cover ?? null };
}
