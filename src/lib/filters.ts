import { normTitle } from "../store/follows";
import type { AnimeItem } from "../types";

/** 全站搜索 + 徽章筛选 + 只看连载（迭代计划书 M5 效率功能） */
export type BadgeKey = "独播" | "SVIP抢先" | "限免" | "超前点映" | "结局点映" | "大结局" | "完结";

export interface ItemFilters {
  query: string;
  badges: ReadonlySet<BadgeKey>;
  ongoingOnly: boolean;
}

export const NO_FILTERS: ItemFilters = { query: "", badges: new Set(), ongoingOnly: false };

export function itemBadges(item: AnimeItem): BadgeKey[] {
  const out: BadgeKey[] = [];
  if (item.svip) out.push("SVIP抢先");
  if (item.badge === "独播") out.push("独播");
  if (item.badge === "限免") out.push("限免");
  if (item.badge === "超前点映") out.push("超前点映");
  if (item.badge === "结局点映") out.push("结局点映");
  if (item.badge === "大结局") out.push("大结局");
  if (item.finished) out.push("完结");
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
  if (f.ongoingOnly && (item.finished || item.badge === "大结局" || item.badge === "结局点映")) return false;
  return true;
}

export function applyFilters(items: AnimeItem[], f: ItemFilters): AnimeItem[] {
  return items.filter((i) => matchesFilters(i, f));
}
