import { normTitle } from "../store/follows";
import type { AnimeItem } from "../types";

/** 全站搜索 + 徽章筛选 + 只看连载（迭代计划书 M5 效率功能） */
export type BadgeKey = "独播" | "SVIP抢先" | "限免" | "点映" | "完结";

export interface ItemFilters {
  query: string;
  badges: ReadonlySet<BadgeKey>;
  ongoingOnly: boolean;
}

export const NO_FILTERS: ItemFilters = { query: "", badges: new Set(), ongoingOnly: false };

/** 徽章包含匹配：兼容「限免中 / 逐集限免 / 独播、限免」等多值/变体写法 */
export function badgeHas(item: AnimeItem, key: string): boolean {
  return !!item.badge && item.badge.includes(key);
}

export function itemBadges(item: AnimeItem): BadgeKey[] {
  const out: BadgeKey[] = [];
  if (item.svip) out.push("SVIP抢先");
  if (badgeHas(item, "独播")) out.push("独播");
  if (badgeHas(item, "限免")) out.push("限免");
  if (badgeHas(item, "点映")) out.push("点映"); // 超前点映 / 结局点映 合并为一个筛选维度
  if (item.finished || badgeHas(item, "大结局")) out.push("完结"); // 大结局并入完结
  return out;
}

export function matchesFilters(item: AnimeItem, f: ItemFilters): boolean {
  if (f.query) {
    const q = normTitle(f.query);
    if (q && !normTitle(item.title).includes(q)) return false;
  }
  if (f.badges.size) {
    const badges = itemBadges(item);
    if (![...f.badges].some((b) => badges.includes(b))) return false;
  }
  if (f.ongoingOnly && (item.finished || badgeHas(item, "大结局") || badgeHas(item, "结局点映"))) return false;
  return true;
}

export function applyFilters(items: AnimeItem[], f: ItemFilters): AnimeItem[] {
  return items.filter((i) => matchesFilters(i, f));
}
