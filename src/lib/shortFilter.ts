import { useEffect, useState } from "react";
import type { AnimeItem } from "../types";

const KEY = "anime-calendar.shortfilter.v1";
const DEFAULT = { enabled: true, thresholdSec: 300 };

export interface ShortFilter {
  enabled: boolean;
  thresholdSec: number;
}

function load(): ShortFilter {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      const sec = Number(p.thresholdSec);
      if (typeof p.enabled === "boolean" && Number.isFinite(sec) && sec > 0) {
        return { enabled: p.enabled, thresholdSec: Math.round(sec) };
      }
    }
  } catch {
    /* 忽略损坏配置 */
  }
  return DEFAULT;
}

let config: ShortFilter = typeof localStorage !== "undefined" ? load() : DEFAULT;
/** 被屏蔽剧集（规范化标题集合），由 BlockedProvider 同步；仅「阈值 ≤1 分钟」时参与过滤 */
let blockedTitles = new Set<string>();
const listeners = new Set<() => void>();

function normKey(t: string): string {
  return String(t).replace(/[·：\s-]/g, "").toLowerCase();
}

export function setBlockedTitles(titles: Iterable<string>): void {
  blockedTitles = new Set(titles);
  listeners.forEach((l) => l());
}

export function getShortFilter(): ShortFilter {
  return config;
}

export function setShortFilter(next: ShortFilter): void {
  config = { enabled: !!next.enabled, thresholdSec: Math.max(1, Math.round(next.thresholdSec)) };
  try {
    localStorage.setItem(KEY, JSON.stringify(config));
  } catch {
    /* 忽略 */
  }
  listeners.forEach((l) => l());
}

/** 订阅过滤配置变更：组件调用后在过滤开关/阈值变化时重渲染 */
export function useShortFilterVersion(): number {
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

/** 应用短剧过滤：关闭时全部保留；开启时保留未知时长与 >= 阈值的条目 */
export function applyShortFilter(items: AnimeItem[]): AnimeItem[] {
  if (!config.enabled) return items;
  return items.filter((i) => {
    if (i.duration != null && i.duration < config.thresholdSec) return false;
    // 过滤开关开启即隐藏用户手动屏蔽的剧集（任意阈值）
    if (blockedTitles.has(normKey(i.title))) return false;
    // 过滤开关开启即隐藏优酷名称含断句标点的条目（AI 短剧常见特征，如「XX，XX」「XX：XX」；
    // 仅匹配 、，。：；，避免误伤「是王者啊？第六季」这类带问号的正剧标题）
    if (i.platform === "youku" && /[，。：；、]/.test(i.title)) return false;
    return true;
  });
}
