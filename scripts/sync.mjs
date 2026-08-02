/**
 * 数据管道编排器（计划 §3.5 / §5.2）
 * 抓取四平台 → 时长过滤 → 去重 → 最新集解析 → 写 data/updates.json
 *
 * 失败策略：单平台失败仍写 updates.json（error 字段 + 保留上次成功数据）；
 * 只有完全无法产出数据时才退出非零。
 */
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join, resolve } from "path";
import { scrape as scrapeBili } from "./bilibili.mjs";
import { scrape as scrapeYouku } from "./youku.mjs";
import { scrape as scrapeTencent } from "./tencent.mjs";
import { scrape as scrapeIqiyi } from "./iqiyi.mjs";
import { doubanLookup } from "./douban.mjs";
import { addDays, mondayOfWeekBeijing, sortByDateThenTime, ymd } from "./shared.mjs";
import { writeHistory } from "./history.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_FILE = join(ROOT, "data", "updates.json");
const HISTORY_FILE = join(ROOT, "data", "history.json");

/** 北京时区「今天」YYYY-MM-DD（runner 常为 UTC，勿用本地日期） */
function beijingToday() {
  const n = new Date(Date.now() + 8 * 3600 * 1000);
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}-${String(n.getUTCDate()).padStart(2, "0")}`;
}
const FETCH_LIMIT = { youku: 80, default: 40 }; // 单次同步富集请求上限（计划 §9；优酷唯一标题多，放宽到 80）
const PLATFORM_TIMEOUT_MS = { tencent: 480_000, default: 240_000 }; // 单平台抓取硬超时（防 CI 卡死；腾讯需逐集点击解析）

const PLATFORMS = [
  { platform: "bili", label: "哔哩哔哩", scrape: scrapeBili },
  { platform: "youku", label: "优酷", scrape: scrapeYouku },
  { platform: "tencent", label: "腾讯视频", scrape: scrapeTencent },
  { platform: "iqiyi", label: "爱奇艺", scrape: scrapeIqiyi },
];

function loadPrevious() {
  try {
    return JSON.parse(readFileSync(DATA_FILE, "utf8"));
  } catch {
    return null;
  }
}

/**
 * 清洗层步骤 1：时长处理（前端提供「过滤短剧」开关与可调阈值，默认 300s）：
 * - 已知时长的短条目（<300s）**保留**并携带 duration，由前端过滤控制展示；
 * - 内容类型排除：标题含「动态漫/AI动漫/泡面番」（AI 生成短剧）的条目直接丢弃并记 warnings，与时长无关。
 */
export function cleanDuration(items, warnings) {
  const kept = [];
  let missing = 0;
  let dropped = 0;
  let short = 0;
  for (const it of items) {
    if (/动态漫|AI动漫|泡面番/.test(it.title)) {
      warnings.push(`内容类型排除（动态漫/AI动漫/泡面番）：${it.title}`);
      dropped++;
      continue;
    }
    if (typeof it.duration === "number" && it.duration > 0 && it.duration < 300) {
      short++;
    }
    if (it.duration == null || it.duration <= 0) {
      missing++;
      it.duration = null;
    }
    kept.push(it);
  }
  if (short) warnings.push(`已保留 ${short} 条不足 5 分钟（<300 秒）的短条目，前端「过滤短剧」默认隐藏可调整`);
  if (missing) warnings.push(`${missing} 条时长无法确认已保留（平台未提供内联时长）`);
  if (dropped) warnings.push(`已排除 ${dropped} 条动态漫/AI动漫/泡面番条目`);
  return kept;
}

/** 清洗层补充：仅保留当前自然周（周一~周日）内的条目 */
export function keepCurrentWeek(items, warnings) {
  // 按北京时区计算周边界：GitHub Actions runner 为 UTC，直接用本地日期会在
  // 周一 07:00（北京）那次同步（UTC 周日 23:00）错用上一周的区间。
  const mon = mondayOfWeekBeijing();
  const sun = addDays(mon, 6);
  const min = ymd(mon);
  const max = ymd(sun);
  const kept = items.filter((i) => i.date >= min && i.date <= max);
  if (kept.length !== items.length) warnings.push(`过滤 ${items.length - kept.length} 条不在本周（${min}~${max}）的条目`);
  return kept;
}

/**
 * 豆瓣甄别（第 10 项需求）：仅对优酷/爱奇艺「时长缺失或 <1 分钟」的条目做豆瓣搜索——
 * 精确命中且暂无评分 → 疑似 AI 短剧丢弃；精确命中且已有评分 → 保留；未命中/查询失败 → 保留。
 * 反爬约束：每次同步豆瓣查询全局上限 10 次、间隔 2s，命中验证码时 fail-open。
 */
async function doubanShortDramaFilter(items, platform, warnings, { log }) {
  if (platform !== "youku" && platform !== "iqiyi") return items;
  const suspicious = items.filter((i) => i.duration == null || (i.duration > 0 && i.duration < 60));
  if (!suspicious.length) return items;

  // 豆瓣「暂无评分」但确认为正规剧集的条目（避免误杀）：B站国创《苏东坡与杭州的故事》、《是王者啊？第六季》等
  const UNRATED_WHITELIST = new Set(["苏东坡与杭州的故事", "是王者啊？第六季", "是王者啊？第6季"]);
  // 用户经评论区等渠道人工确认的 AI 短剧（自动判据覆盖不到时兜底）：云月大陆评论区出现「AI漫剧」
  const CURATED_AI_SHORTS = new Set(["云月大陆"]);
  const MAX_QUERIES = 10;
  const DELAY_MS = 2000;
  const cache = new Map();
  let queries = 0;
  let dropped = 0;
  let curated = 0;
  let nomatch = 0;
  let quotaLeft = 0;
  let failed = 0;
  const kept = [];

  // 查询优先级：标点命名/AI 常见词/一周多次出现的条目优先消耗豆瓣配额（AI 短剧特征）
  const AI_KEYWORD_RE = /开局|无敌|逆天|系统|穿越|废|宠|御兽|修仙|觉醒|大婚|赘婿|龙王|神医|战神|宗门|仙帝|杀伐|苟/;
  const score = (it) => (/[，。！？：；、]/.test(it.title) ? 3 : 0) + (AI_KEYWORD_RE.test(it.title) ? 2 : 0) + (items.filter((x) => x.title === it.title).length > 1 ? 1 : 0);
  const queryOrder = [...new Map(suspicious.map((i) => [i.title, i])).values()].sort((a, b) => score(b) - score(a));
  for (const it of queryOrder) {
    if (queries >= MAX_QUERIES) break;
    queries++;
    const r = await doubanLookup(it.title);
    await new Promise((res) => setTimeout(res, DELAY_MS));
    if (!r.ok) {
      cache.set(it.title, "fail");
      failed++;
    } else if (r.exact && r.exact.unrated && !UNRATED_WHITELIST.has(it.title)) {
      cache.set(it.title, "drop");
    } else if (r.exact && r.exact.unrated && UNRATED_WHITELIST.has(it.title)) {
      cache.set(it.title, "keep");
      log(`豆瓣暂无评分但命中白名单，保留：${it.title}`);
    } else if (r.exact && r.exact.rated) {
      cache.set(it.title, "keep");
    } else {
      cache.set(it.title, "nomatch");
    }
  }

  for (const it of items) {
    const isSus = it.duration == null || (it.duration > 0 && it.duration < 60);
    if (!isSus) {
      kept.push(it);
      continue;
    }
    if (CURATED_AI_SHORTS.has(it.title)) {
      curated++;
      log(`人工确认 AI 短剧排除：${it.title}`);
      continue;
    }
    if (!cache.has(it.title)) {
      cache.set(it.title, "quota");
      quotaLeft++;
    }
    const verdict = cache.get(it.title);
    if (verdict === "drop") {
      dropped++;
      log(`豆瓣暂无评分（疑似 AI 短剧）排除：${it.title}`);
      continue;
    }
    if (verdict === "nomatch") nomatch++;
    kept.push(it);
  }

  if (curated) warnings.push(`已按人工确认黑名单排除 ${curated} 条 AI 短剧（评论区等渠道确认，如云月大陆）`);
  if (dropped) warnings.push(`已按豆瓣判据排除 ${dropped} 条疑似 AI 短剧（时长缺失/过短且豆瓣条目暂无评分）`);
  if (nomatch) warnings.push(`${nomatch} 条时长缺失条目豆瓣未精确命中，已保留（避免别名/收录差异误伤）`);
  if (quotaLeft) warnings.push(`${quotaLeft} 条时长缺失条目超出豆瓣查询配额，已保留`);
  if (failed) warnings.push(`${failed} 条豆瓣查询失败（反爬/网络），已保留`);
  return kept;
}

/** 完结判定：剧集文案/标签含大结局、完结、全X话/集、X集全 等标记 */
function finishedOf(it) {
  if (it.badge === "大结局" || it.badge === "结局点映") return true;
  return /(大结局|完结|已完结|全\s*\d+\s*(话|集)|\d+\s*集全)/.test(`${it.episode ?? ""} ${it.rule ?? ""}`);
}

/**
 * 下一周排期预测（第 7 轮需求）：本周未完结条目按「同星期、同时段」+7 天推导下周排期，
 * 标记 predicted 供前端显示「预计」；已完结条目标记 finished 且不生成下周排期。
 * 注意：预测为启发式（平台原始数据仅覆盖本周），不参与清洗/时长/豆瓣过滤。
 */
export function extendNextWeek(items, warnings) {
  const out = [];
  let predicted = 0;
  let finished = 0;
  for (const it of items) {
    if (finishedOf(it)) {
      finished++;
      out.push({ ...it, finished: true });
      continue;
    }
    out.push(it);
    const next = { ...it, id: `${it.id}-pred`, date: ymd(addDays(new Date(`${it.date}T00:00:00`), 7)), predicted: true };
    const m = String(it.episode ?? "").match(/(?:第|更新至)(\d+)(集|话)/);
    if (m) next.episode = `第${Number(m[1]) + 1}${m[2]}`;
    out.push(next);
    predicted++;
  }
  if (predicted) warnings.push(`已生成下周预计排期 ${predicted} 条（本周未完结条目 +7 天推导，前端标「预计」）`);
  if (finished) warnings.push(`${finished} 条剧集已完结，不生成下周排期`);
  return out;
}

async function main() {
  const prev = loadPrevious();
  const platforms = [];
  let anyData = false;

  for (const p of PLATFORMS) {
    try {
      const timeoutMs = PLATFORM_TIMEOUT_MS[p.platform] ?? PLATFORM_TIMEOUT_MS.default;
      const result = await Promise.race([
        p.scrape({ fetchLimit: FETCH_LIMIT[p.platform] ?? FETCH_LIMIT.default, log: (m) => console.log(`[${p.platform}] ${m}`) }),
        new Promise((_, reject) => setTimeout(() => reject(new Error(`超时（>${timeoutMs / 1000}s）`)), timeoutMs)),
      ]);
      result.warnings = Array.isArray(result.warnings) ? result.warnings : [];
      result.items = cleanDuration(result.items, result.warnings);
      result.items = keepCurrentWeek(result.items, result.warnings);
      result.items = await doubanShortDramaFilter(result.items, p.platform, result.warnings, { log: (m) => console.log(`[${p.platform}] ${m}`) });
      result.items = extendNextWeek(result.items, result.warnings);
      result.items = sortByDateThenTime(result.items);
      result.fetchedAt = new Date().toISOString();
      delete result.error;
      // 防复发自检：今天无真实条目时告警（爱奇艺「今天」tab、优酷「今」tab 曾反复回归）
      const todayStr = beijingToday();
      if (!result.items.some((i) => i.date === todayStr && !i.predicted)) {
        result.warnings.push(`警告：今天（${todayStr}）未抓到真实条目，请核查星期 tab/日期映射（爱奇艺「今天」/优酷「今」）`);
      }
      platforms.push(result);
      anyData = true;
      console.log(`[${p.platform}] 成功：${result.items.length} 条`);
    } catch (err) {
      console.error(`[${p.platform}] 抓取失败：${err.message}`);
      const prevRes = prev?.platforms?.find((x) => x.platform === p.platform);
      // 回退上次成功数据同样走清洗层（动态漫画排除 / 周过滤等保持生效）
      const fbItems = [...(prevRes?.items ?? [])];
      const fbWarnings = [];
      const cleaned = cleanDuration(fbItems, fbWarnings);
      const kept = keepCurrentWeek(cleaned, fbWarnings);
      const kept2 = await doubanShortDramaFilter(kept, p.platform, fbWarnings, { log: (m) => console.log(`[${p.platform}] ${m}`) });
      const kept3 = extendNextWeek(kept2, fbWarnings);
      const fbToday = beijingToday();
      if (!kept3.some((i) => i.date === fbToday && !i.predicted)) {
        fbWarnings.push(`警告：今天（${fbToday}）未抓到真实条目（回退数据），请核查星期 tab/日期映射`);
      }
      platforms.push({
        platform: p.platform,
        label: p.label,
        items: sortByDateThenTime(kept3),
        error: err.message,
        fetchedAt: prevRes?.fetchedAt ?? null,
        warnings: fbWarnings,
      });
      if (!prevRes) console.error(`[${p.platform}] 无上次成功数据，输出空 items`);
    }
  }

  const output = { generatedAt: new Date().toISOString(), platforms };
  mkdirSync(dirname(DATA_FILE), { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(output, null, 2), "utf8");
  console.log(`已写入 ${DATA_FILE}（${platforms.reduce((n, x) => n + x.items.length, 0)} 条）`);
  try {
    writeHistory(DATA_FILE, HISTORY_FILE);
  } catch (err) {
    // 历史归档失败不影响 updates.json 发布（仅历史周导航暂缺数据）
    console.error(`history 归档失败（继续部署）：${err.message}`);
  }

  const failed = platforms.filter((x) => x.error);
  if (failed.length) console.error(`失败平台告警：${failed.map((x) => `${x.platform}(${x.error})`).join("；")}`);

  if (!anyData && !platforms.some((x) => x.items.length)) {
    console.error("完全无法产出数据，退出非零");
    process.exit(1);
  }
  // 显式退出：清理超时平台的遗留句柄/浏览器进程
  process.exit(0);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  main().catch((err) => {
    console.error("sync 失败：", err);
    process.exit(1);
  });
}
