import { addDays, dstr } from "./date";
import { applyShortFilter } from "./shortFilter";
import { ITEMS, WEEK_START } from "../store/data";
import type { AnimeItem, PlatformFilter } from "../types";

/**
 * 数据访问层（M0 使用示例数据）。
 * M1 起改为加载 data/updates.json（结构与 AnimeItem 契约一致），本层接口保持不变。
 */
export function itemsFor(platform: PlatformFilter): AnimeItem[] {
  const base = platform === "all" ? ITEMS : ITEMS.filter((i) => i.platform === platform);
  return applyShortFilter(base);
}

export function itemsOn(date: Date, platform: PlatformFilter): AnimeItem[] {
  const ds = dstr(date);
  return itemsFor(platform)
    .filter((i) => i.date === ds)
    .sort((a, b) => a.updateTime.localeCompare(b.updateTime));
}

export function platformCounts(): Record<PlatformFilter, number> {
  // 看板计数仅统计本周（预测的下一周条目不计入，避免翻倍）
  const weekStart = dstr(WEEK_START);
  const weekEnd = dstr(addDays(WEEK_START, 6));
  const filtered = applyShortFilter(ITEMS).filter((i) => i.date >= weekStart && i.date <= weekEnd);
  const counts: Record<PlatformFilter, number> = { all: filtered.length, bili: 0, tencent: 0, youku: 0, iqiyi: 0 };
  for (const item of filtered) counts[item.platform]++;
  return counts;
}

/** 按标题找当前周数据的海报（追番列表等未持久化海报的场景使用） */
export function posterForTitle(title: string): string | undefined {
  const norm = (t: string) => t.replace(/[·．\s:：]/g, "").toLowerCase();
  const k = norm(title);
  return ITEMS.find((i) => norm(i.title) === k)?.poster;
}
