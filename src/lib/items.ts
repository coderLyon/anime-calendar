import { SAMPLE_ITEMS } from "../data/items";
import { dstr } from "./date";
import type { AnimeItem, PlatformFilter } from "../types";

/**
 * 数据访问层（M0 使用示例数据）。
 * M1 起改为加载 data/updates.json（结构与 AnimeItem 契约一致），本层接口保持不变。
 */
export function itemsFor(platform: PlatformFilter): AnimeItem[] {
  return platform === "all" ? SAMPLE_ITEMS : SAMPLE_ITEMS.filter((i) => i.platform === platform);
}

export function itemsOn(date: Date, platform: PlatformFilter): AnimeItem[] {
  const ds = dstr(date);
  return itemsFor(platform)
    .filter((i) => i.date === ds)
    .sort((a, b) => a.updateTime.localeCompare(b.updateTime));
}

export function platformCounts(): Record<PlatformFilter, number> {
  const counts: Record<PlatformFilter, number> = { all: SAMPLE_ITEMS.length, bili: 0, tencent: 0, youku: 0, iqiyi: 0 };
  for (const item of SAMPLE_ITEMS) counts[item.platform]++;
  return counts;
}
