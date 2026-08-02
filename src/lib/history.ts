import type { HistoryFile } from "../types";

/** 历史周归档懒加载（多周导航用）：CI bot 回写 data/history.json 后经 raw/jsDelivr 拉取 */
let cache: HistoryFile | null = null;

export async function loadHistoryFile(force = false): Promise<HistoryFile> {
  if (cache && !force) return cache;
  const ts = Date.now();
  const urls = [
    `https://raw.githubusercontent.com/coderLyon/anime-calendar/main/data/history.json?ts=${ts}`,
    `https://cdn.jsdelivr.net/gh/coderLyon/anime-calendar@main/data/history.json?ts=${ts}`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
      if (!res.ok) continue;
      const j = (await res.json()) as HistoryFile;
      if (j && Array.isArray(j.weeks)) {
        cache = j;
        return j;
      }
    } catch {
      /* 下一个源 */
    }
  }
  return { updatedAt: null, weeks: [] };
}
