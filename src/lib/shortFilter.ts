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
const listeners = new Set<() => void>();

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
  const strict = config.thresholdSec <= 60;
  return items.filter((i) => {
    if (i.duration != null && i.duration < config.thresholdSec) return false;
    // 阈值 ≤ 1 分钟时额外排除优酷名称含标点符号的条目（AI 短剧常见特征，如「XX，XX」「XX：XX」）
    if (strict && i.platform === "youku" && /[，。！？：；、]/.test(i.title)) return false;
    return true;
  });
}
