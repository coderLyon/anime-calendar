import updates from "../../data/updates.json";
import { SAMPLE_ITEMS } from "../data/items";
import { addDays } from "../lib/date";
import { useEffect, useState } from "react";
import type { AnimeItem } from "../types";

const rawUpdates = updates as { generatedAt?: string; platforms?: { items?: AnimeItem[] }[] };

/**
 * 数据源：data/updates.json（npm run sync / Actions 生成，构建时打包）。
 * 若文件缺失或为空（开发环境），回退到示例数据。
 * M5 起支持运行时刷新：CI bot 回写后，「刷新」从 raw.githubusercontent 拉取最新文件，
 * 通过 useDataVersion 订阅让视图重新渲染。
 */
function buildItems(): AnimeItem[] {
  const list: AnimeItem[] = [];
  for (const p of rawUpdates.platforms ?? []) {
    if (p.items?.length) list.push(...p.items);
  }
  return list.length ? list : SAMPLE_ITEMS;
}

export let ITEMS = buildItems();
export let GENERATED_AT: string | null = rawUpdates.generatedAt ?? null;

/** 数据覆盖周（取最小日期所在周的周一） */
function computeWeekStart(): Date {
  const dates = ITEMS.map((i) => i.date).filter(Boolean).sort();
  const base = dates[0] ? new Date(`${dates[0]}T00:00:00`) : new Date();
  return addDays(new Date(base.getFullYear(), base.getMonth(), base.getDate()), -(((base.getDay() + 6) % 7)));
}

export let WEEK_START = computeWeekStart();

const listeners = new Set<() => void>();

/** 数据版本订阅：ITEMS/GENERATED_AT/WEEK_START 更新后触发重渲染 */
export function useDataVersion(): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    const l = () => setV((x) => x + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return v;
}

function emit(): void {
  listeners.forEach((l) => l());
}

function applyRemote(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const d = data as { generatedAt?: string; platforms?: { items?: AnimeItem[] }[] };
  if (!Array.isArray(d.platforms)) return false;
  const list: AnimeItem[] = [];
  for (const p of d.platforms) {
    if (Array.isArray(p.items)) list.push(...p.items);
  }
  if (!list.length) return false;
  ITEMS = list;
  GENERATED_AT = d.generatedAt ?? GENERATED_AT;
  WEEK_START = computeWeekStart();
  emit();
  return true;
}

/**
 * 真实刷新：优先 raw.githubusercontent（CI bot 回写后的最新数据），
 * 失败回退 jsDelivr 镜像；都失败则保留构建时数据并返回 false。
 */
export async function refreshFromRemote(): Promise<boolean> {
  const ts = Date.now();
  const urls = [
    `https://raw.githubusercontent.com/coderLyon/anime-calendar/main/data/updates.json?ts=${ts}`,
    `https://cdn.jsdelivr.net/gh/coderLyon/anime-calendar@main/data/updates.json?ts=${ts}`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) continue;
      if (applyRemote(await res.json())) return true;
    } catch {
      /* 尝试下一个源 */
    }
  }
  return false;
}

export function today(): Date {
  return new Date();
}

export const TODAY = today();
