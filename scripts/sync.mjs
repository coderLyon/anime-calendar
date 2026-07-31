/**
 * 数据管道编排器（计划 §3.5 / §5.2）
 * 抓取四平台 → 时长过滤 → 去重 → 最新集解析 → 写 data/updates.json
 *
 * 失败策略：单平台失败仍写 updates.json（error 字段 + 保留上次成功数据）；
 * 只有完全无法产出数据时才退出非零。
 */
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { scrape as scrapeBili } from "./bilibili.mjs";
import { scrape as scrapeYouku } from "./youku.mjs";
import { scrape as scrapeTencent } from "./tencent.mjs";
import { scrape as scrapeIqiyi } from "./iqiyi.mjs";
import { sortByDateThenTime, ymd } from "./shared.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_FILE = join(ROOT, "data", "updates.json");
const FETCH_LIMIT = 40; // 单次同步富集请求上限（计划 §9）

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

/** 清洗层步骤 1：时长过滤（<600s 丢弃；缺失时长关键词兜底并记 warnings） */
function cleanDuration(items, warnings) {
  const kept = [];
  let missing = 0;
  let dropped = 0;
  for (const it of items) {
    if (typeof it.duration === "number" && it.duration > 0 && it.duration < 600) {
      dropped++;
      continue;
    }
    if (it.duration == null || it.duration <= 0) {
      if (/动态漫|AI动漫|泡面番/.test(it.title)) {
        warnings.push(`时长无法确认且命中关键词，已丢弃：${it.title}`);
        dropped++;
        continue;
      }
      missing++;
      it.duration = null;
    }
    kept.push(it);
  }
  if (dropped) warnings.push(`时长过滤：丢弃 ${dropped} 条时长过短/无法确认条目`);
  if (missing) warnings.push(`${missing} 条时长无法确认已保留（平台未提供内联时长）`);
  return kept;
}

/** 清洗层补充：仅保留当前自然周（周一~周日）内的条目 */
function keepCurrentWeek(items, warnings) {
  const now = new Date();
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const min = ymd(mon);
  const max = ymd(sun);
  const kept = items.filter((i) => i.date >= min && i.date <= max);
  if (kept.length !== items.length) warnings.push(`过滤 ${items.length - kept.length} 条不在本周（${min}~${max}）的条目`);
  return kept;
}

async function main() {
  const prev = loadPrevious();
  const platforms = [];
  let anyData = false;

  for (const p of PLATFORMS) {
    try {
      const result = await p.scrape({ fetchLimit: FETCH_LIMIT, log: (m) => console.log(`[${p.platform}] ${m}`) });
      result.warnings = Array.isArray(result.warnings) ? result.warnings : [];
      result.items = cleanDuration(result.items, result.warnings);
      result.items = keepCurrentWeek(result.items, result.warnings);
      result.items = sortByDateThenTime(result.items);
      result.fetchedAt = new Date().toISOString();
      delete result.error;
      platforms.push(result);
      anyData = true;
      console.log(`[${p.platform}] 成功：${result.items.length} 条`);
    } catch (err) {
      console.error(`[${p.platform}] 抓取失败：${err.message}`);
      const prevRes = prev?.platforms?.find((x) => x.platform === p.platform);
      platforms.push({
        platform: p.platform,
        label: p.label,
        items: prevRes?.items ?? [],
        error: err.message,
        fetchedAt: prevRes?.fetchedAt ?? null,
        warnings: prevRes?.warnings ?? [],
      });
      if (!prevRes) console.error(`[${p.platform}] 无上次成功数据，输出空 items`);
    }
  }

  const output = { generatedAt: new Date().toISOString(), platforms };
  mkdirSync(dirname(DATA_FILE), { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(output, null, 2), "utf8");
  console.log(`已写入 ${DATA_FILE}（${platforms.reduce((n, x) => n + x.items.length, 0)} 条）`);

  const failed = platforms.filter((x) => x.error);
  if (failed.length) console.error(`失败平台告警：${failed.map((x) => `${x.platform}(${x.error})`).join("；")}`);

  if (!anyData && !platforms.some((x) => x.items.length)) {
    console.error("完全无法产出数据，退出非零");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("sync 失败：", err);
  process.exit(1);
});
