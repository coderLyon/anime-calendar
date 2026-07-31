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
  normUrl,
  parseJsObject,
  ymd,
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
  const weekMonday = mondayOf(new Date());

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
          ep.pub_ts && ep.pub_ts > 0 ? ymd(new Date(ep.pub_ts * 1000)) : ymd(addDays(weekMonday, dow - 1));
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
          badge: ep.rating ? String(ep.rating) : null,
          duration: null, // 由时长富集填充
        });
      }
    }
  }

  if (!items.length) throw new Error("未解析到任何排期条目");

  await enrichDurations(items, { fetchLimit, log });

  return { platform: PLATFORM, label: LABEL, items, fetchedAt: new Date().toISOString(), warnings: [] };
}

/** 时长富集：去重后唯一番剧抓剧集页，读 playurl 的 timelength（毫秒） */
async function enrichDurations(items, { fetchLimit, log }) {
  const cache = createCache();
  const uniq = [...new Map(items.map((i) => [i.id, i])).values()];
  let fetched = 0;
  for (const it of uniq) {
    if (cache.get(it.id) !== undefined) continue;
    if (fetched >= fetchLimit) break;
    try {
      const epHtml = await fetchText(it.url, { referer: "https://www.bilibili.com/guochuang/", timeout: 8000 });
      const m = epHtml.match(/"timelength":(\d+)/);
      const ms = m ? Number(m[1]) : null;
      cache.set(it.id, ms ? Math.round(ms / 1000) : null);
      fetched++;
    } catch (err) {
      cache.set(it.id, null);
      log(`时长富集失败 ${it.title}: ${err.message}`);
    }
  }
  for (const it of items) {
    const dur = cache.get(it.id);
    if (dur !== undefined) it.duration = dur;
  }
  log(`时长富集完成：抓取 ${fetched} 页，命中 ${uniq.filter((i) => cache.get(i.id)).length}/${uniq.length} 条`);
}

function mondayOf(d) {
  const day = ((d.getDay() + 6) % 7); // 0=周一
  return addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -day);
}
