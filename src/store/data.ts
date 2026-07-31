import updates from "../../data/updates.json";
import { SAMPLE_ITEMS } from "../data/items";
import { addDays } from "../lib/date";
import type { AnimeItem } from "../types";

const rawUpdates = updates as { generatedAt?: string; platforms?: { items?: AnimeItem[] }[] };

export const GENERATED_AT = rawUpdates.generatedAt ?? null;

/**
 * 数据源：data/updates.json（npm run sync / Actions 生成，构建时打包）。
 * 若文件缺失或为空（开发环境），回退到示例数据。
 */
function buildItems(): AnimeItem[] {
  const list: AnimeItem[] = [];
  for (const p of rawUpdates.platforms ?? []) {
    if (p.items?.length) list.push(...p.items);
  }
  return list.length ? list : SAMPLE_ITEMS;
}

export const ITEMS = buildItems();

/** 数据覆盖周（取最小日期所在周的周一） */
function computeWeekStart(): Date {
  const dates = ITEMS.map((i) => i.date).filter(Boolean).sort();
  const base = dates[0] ? new Date(`${dates[0]}T00:00:00`) : new Date();
  return addDays(new Date(base.getFullYear(), base.getMonth(), base.getDate()), -(((base.getDay() + 6) % 7)));
}

export const WEEK_START = computeWeekStart();

export function today(): Date {
  return new Date();
}

export const TODAY = today();
