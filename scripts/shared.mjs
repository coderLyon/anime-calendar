/**
 * 四平台抓取公共工具（计划 §3）。
 * 约定：平台抓取失败即 throw，由编排器写入 error 字段并保留上次成功数据。
 */

export const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/** 内容黑名单：仅用于最新集解析（跳过非正剧条目），不参与周表过滤 */
export const CONTENT_BLOCKLIST = ["小课堂", "发布会", "预告", "片花", "花絮", "幕后", "访谈", "见面会", "先导", "抢先看"];

export function isBlocked(title) {
  return CONTENT_BLOCKLIST.some((k) => String(title).includes(k));
}

/** 浏览器式 fetch：UA / Referer / 15s 超时；非 2xx 即 throw */
export async function fetchText(url, { referer, timeout = 15000 } = {}) {
  const res = await fetch(url, {
    headers: {
      "user-agent": UA,
      accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
      "accept-language": "zh-CN,zh;q=0.9",
      ...(referer ? { referer } : {}),
    },
    signal: AbortSignal.timeout(timeout),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

/** 提取 `window.NAME = {...};` 的原始对象文本（括号配对，字符串感知） */
export function extractAssignedObject(html, name) {
  const re = new RegExp(`window\\.${name}\\s*=\\s*`);
  const m = re.exec(html);
  if (!m) return null;
  let i = m.index + m[0].length;
  while (i < html.length && /\s/.test(html[i])) i++;
  if (html[i] !== "{") return null;
  let depth = 0;
  let inStr = false;
  let quote = "";
  const start = i;
  for (; i < html.length; i++) {
    const c = html[i];
    if (inStr) {
      if (c === "\\") {
        i++;
        continue;
      }
      if (c === quote) inStr = false;
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = true;
      quote = c;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return html.slice(start, i + 1);
    }
  }
  return null;
}

/** 把 JS 对象字面量清洗为可解析 JSON（注释/尾逗号/undefined/单引号） */
export function parseJsObject(text) {
  let t = text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])[ \t]*\/\/.*$/gm, "$1")
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/\bundefined\b/g, "null")
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/'/g, '"');
  try {
    return JSON.parse(t);
  } catch (err) {
    throw new Error(`parseJsObject failed: ${err.message}`);
  }
}

export function httpsImg(url) {
  return url ? url.replace(/^http:/, "https:") : url;
}

export function normUrl(url) {
  if (!url) return url;
  return url.startsWith("//") ? `https:${url}` : url;
}

export function ymd(d) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** 北京时区（UTC+8）墙上时间：返回的 Date 的 UTC 分量即北京日历时间（任意 runner 时区结果一致） */
export function beijingWall(d = new Date()) {
  return new Date(d.getTime() + 8 * 3600 * 1000);
}

/** 北京日历日期（yyyy-MM-dd） */
export function ymdBeijing(d = new Date()) {
  const w = beijingWall(d);
  const m = String(w.getUTCMonth() + 1).padStart(2, "0");
  const day = String(w.getUTCDate()).padStart(2, "0");
  return `${w.getUTCFullYear()}-${m}-${day}`;
}

/** 北京时区「当前周」的周一（Date.UTC 构造，保证任意时区下 ymd/addDays 结果一致） */
export function mondayOfWeekBeijing(d = new Date()) {
  const w = beijingWall(d);
  const dow = (w.getUTCDay() + 6) % 7; // 0=周一
  return new Date(Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate() - dow));
}

export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function zhWeekday(d) {
  return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][d.getDay()];
}

export function epKey(episode) {
  return String(episode).replace(/[^0-9a-zA-Z]/g, "").toLowerCase();
}

export function normalizeTitle(t) {
  return String(t).replace(/[\s·．:：]/g, "").toLowerCase();
}

export function sortByDateThenTime(items) {
  return [...items].sort(
    (a, b) => a.date.localeCompare(b.date) || a.updateTime.localeCompare(b.updateTime),
  );
}

/** 从剧集条目列表中取最大正剧集编号（黑名单跳过，不以 DOM 顺序取末项） */
export function maxEpisodeIndex(list) {
  let max = -1;
  for (const it of list) {
    if (isBlocked(it.title || it.label || "")) continue;
    const nums = String(it.episode ?? it.title ?? "").match(/\d+/g);
    if (!nums) continue;
    for (const n of nums) max = Math.max(max, Number(n));
  }
  return max;
}

/** 富集请求计数缓存：平台 + 番剧键，单次同步上限由调用方传入 */
export function createCache() {
  const map = new Map();
  return {
    get(key) {
      return map.get(key);
    },
    set(key, value) {
      map.set(key, value);
    },
    size() {
      return map.size;
    },
  };
}

export function log(platform, msg) {
  console.log(`[${platform}] ${msg}`);
}
