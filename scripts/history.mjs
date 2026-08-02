/**
 * 历史周归档（迭代计划书 M5）：
 * 从 updates.json 提取每周「真实条目」（不含 predicted），合并进 data/history.json，
 * 滚动保留最近 HISTORY_WEEKS 周，供前端多周导航在切到历史周时懒加载。
 *
 * 可独立运行：node scripts/history.mjs（用当前 data/updates.json 增量合并 history.json）
 * 也会被 sync.mjs 在写出 updates.json 后自动调用。
 */
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join, resolve } from "path";
import { addDays, ymd } from "./shared.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const HISTORY_WEEKS = 8;
export const HISTORY_FILE = join(ROOT, "data", "history.json");

/** 计算某个 YYYY-MM-DD 所在自然周（周一）的 YYYY-MM-DD */
export function mondayOf(dateStr) {
  const base = new Date(`${dateStr}T00:00:00`);
  return ymd(addDays(base, -(((base.getDay() + 6) % 7))));
}

export function loadHistory(file = HISTORY_FILE) {
  try {
    const raw = JSON.parse(readFileSync(file, "utf8"));
    if (raw && Array.isArray(raw.weeks)) return raw;
  } catch {
    /* 不存在或损坏时从空归档开始 */
  }
  return { updatedAt: null, weeks: [] };
}

/**
 * 合并更新：以 weekStart 为键，本周真实条目替换/增量并入对应周；按周倒序保留最近 maxWeeks 周。
 * items 内同 id 以最新一条为准（同一周多次同步时覆盖，避免重复）。
 */
export function mergeHistory(realItems, prev, maxWeeks = HISTORY_WEEKS) {
  const weeks = new Map((prev?.weeks ?? []).map((w) => [w.weekStart, w.items]));
  for (const it of realItems) {
    const wk = mondayOf(it.date);
    const list = weeks.get(wk) ?? [];
    const idx = list.findIndex((x) => x.id === it.id);
    if (idx >= 0) list[idx] = it;
    else list.push(it);
    weeks.set(wk, list);
  }
  const sorted = [...weeks.entries()]
    .map(([weekStart, items]) => ({ weekStart, items }))
    .sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1))
    .slice(0, maxWeeks);
  return { updatedAt: new Date().toISOString(), weeks: sorted };
}

/** 从 updates.json（PlatformResult[]）提取本周真实条目 */
export function realItemsFrom(updates) {
  const out = [];
  for (const p of updates?.platforms ?? []) {
    for (const it of p.items ?? []) {
      if (it?.date && !it.predicted) out.push(it);
    }
  }
  return out;
}

export function buildHistory(updates, prev, maxWeeks = HISTORY_WEEKS) {
  return mergeHistory(realItemsFrom(updates), prev, maxWeeks);
}

/** 读 updates.json + history.json → 写回 history.json（供 sync.mjs 与独立运行共用） */
export function writeHistory(updatesFile, historyFile = HISTORY_FILE, maxWeeks = HISTORY_WEEKS) {
  const updates = JSON.parse(readFileSync(updatesFile, "utf8"));
  const prev = loadHistory(historyFile);
  const next = buildHistory(updates, prev, maxWeeks);
  mkdirSync(dirname(historyFile), { recursive: true });
  writeFileSync(historyFile, JSON.stringify(next, null, 2), "utf8");
  const weeks = next.weeks.map((w) => `${w.weekStart}(${w.items.length})`).join(" ");
  console.log(`已写入 ${historyFile}（${next.weeks.length} 周：${weeks}）`);
  return next;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  try {
    writeHistory(join(ROOT, "data", "updates.json"));
  } catch (err) {
    console.error(`history 归档失败：${err.message}`);
    process.exit(1);
  }
}
