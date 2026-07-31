import { dstr } from "./date";
import { ITEMS } from "../store/data";
import type { AnimeItem, PlatformFilter } from "../types";

/**
 * 数据访问层（M0 使用示例数据）。
 * M1 起改为加载 data/updates.json（结构与 AnimeItem 契约一致），本层接口保持不变。
 */
export function itemsFor(platform: PlatformFilter): AnimeItem[] {
  return platform === "all" ? ITEMS : ITEMS.filter((i) => i.platform === platform);
}

export function itemsOn(date: Date, platform: PlatformFilter): AnimeItem[] {
  const ds = dstr(date);
  return itemsFor(platform)
    .filter((i) => i.date === ds)
    .sort((a, b) => a.updateTime.localeCompare(b.updateTime));
}

export function platformCounts(): Record<PlatformFilter, number> {
  const counts: Record<PlatformFilter, number> = { all: ITEMS.length, bili: 0, tencent: 0, youku: 0, iqiyi: 0 };
  for (const item of ITEMS) counts[item.platform]++;
  return counts;
}
