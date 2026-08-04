import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { onRemoteApplied, queueChange } from "../lib/syncQueue";
import type { AnimeItem, FollowMap, PlatformKey } from "../types";

const FOLLOWS_KEY = "anime-calendar.follows.v1";

export function normTitle(t: string): string {
  return t.replace(/[·．\s:：]/g, "").toLowerCase();
}

/** 是否已追番：按「平台 + 规范化标题」精确判断（同标题跨平台不自动互标） */
export function followedOn(follows: FollowMap, platform: PlatformKey, title: string): boolean {
  return !!follows[normTitle(title)]?.platforms.some((p) => p.platform === platform);
}

/**
 * 平台级追番切换（纯函数）：同标题跨平台各自独立标记。
 * - 已标记该平台 → 移除该平台；平台列表清空时删除整个条目（op=delete）；
 * - 未标记该平台 → 追加到同一追番条目（同标题跨平台合并展示，但不会自动互标）。
 */
export function applyToggle(follows: FollowMap, item: AnimeItem): { next: FollowMap; op: "upsert" | "delete" } {
  const key = normTitle(item.title);
  const existing = follows[key];
  if (existing) {
    const has = existing.platforms.some((p) => p.platform === item.platform);
    if (has) {
      const platforms = existing.platforms.filter((p) => p.platform !== item.platform);
      if (!platforms.length) {
        const next = { ...follows };
        delete next[key];
        return { next, op: "delete" };
      }
      return {
        next: { ...follows, [key]: { ...existing, platforms, updatedAt: new Date().toISOString() } },
        op: "upsert",
      };
    }
    return {
      next: {
        ...follows,
        [key]: {
          ...existing,
          platforms: [
            ...existing.platforms,
            { platform: item.platform, episode: item.episode, updateTime: item.updateTime, url: item.url ?? "#" },
          ],
          updatedAt: new Date().toISOString(),
        },
      },
      op: "upsert",
    };
  }
  return {
    next: {
      ...follows,
      [key]: {
        key,
        title: item.title,
        poster: item.poster,
        platforms: [{ platform: item.platform, episode: item.episode, updateTime: item.updateTime, url: item.url ?? "#" }],
        followedAt: new Date().toISOString().slice(0, 10),
        updatedAt: new Date().toISOString(),
        notify: true,
      },
    },
    op: "upsert",
  };
}

function loadFollows(): FollowMap {
  try {
    const raw = localStorage.getItem(FOLLOWS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as FollowMap;
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch {
    /* 忽略损坏数据，从空开始 */
  }
  return {};
}

interface FollowsApi {
  follows: FollowMap;
  count: number;
  isFollowedOn: (platform: PlatformKey, title: string) => boolean;
  toggle: (item: AnimeItem) => void;
  remove: (key: string) => void;
  setNotify: (key: string, on: boolean) => void;
  exportJson: () => string;
  importJson: (text: string) => number;
}

const FollowsContext = createContext<FollowsApi | null>(null);

export function FollowsProvider({ children }: { children: ReactNode }) {
  const [follows, setFollows] = useState<FollowMap>(loadFollows);

  useEffect(() => {
    try {
      localStorage.setItem(FOLLOWS_KEY, JSON.stringify(follows));
    } catch {
      /* 隐私模式等场景忽略 */
    }
  }, [follows]);

  useEffect(
    () =>
      onRemoteApplied(() => {
        setFollows(loadFollows());
      }),
    [],
  );

  const isFollowedOn = useCallback((platform: PlatformKey, title: string) => followedOn(follows, platform, title), [follows]);

  const toggle = useCallback((item: AnimeItem) => {
    setFollows((prev) => {
      const { next, op } = applyToggle(prev, item);
      queueChange("follows", normTitle(item.title), op);
      return next;
    });
  }, []);

  const remove = useCallback((key: string) => {
    queueChange("follows", key, "delete");
    setFollows((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const setNotify = useCallback((key: string, on: boolean) => {
    queueChange("follows", key, "upsert");
    setFollows((prev) => {
      const cur = prev[key];
      if (!cur) return prev;
      return { ...prev, [key]: { ...cur, notify: on, updatedAt: new Date().toISOString() } };
    });
  }, []);

  const exportJson = useCallback(() => JSON.stringify(follows, null, 2), [follows]);

  const importJson = useCallback((text: string) => {
    const data = JSON.parse(text) as FollowMap;
    if (!data || typeof data !== "object") throw new Error("invalid");
    let added = 0;
    const keys: string[] = [];
    for (const [k, v] of Object.entries(data)) {
      if (v && v.title && Array.isArray(v.platforms)) {
        keys.push(k);
        if (!follows[k]) added++;
      }
    }
    setFollows((prev) => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(data)) {
        if (v && v.title && Array.isArray(v.platforms)) {
          next[k] = v;
        }
      }
      return next;
    });
    keys.forEach((k) => queueChange("follows", k, "upsert"));
    return added;
  }, [follows]);

  const value = useMemo<FollowsApi>(
    () => ({ follows, count: Object.keys(follows).length, isFollowedOn, toggle, remove, setNotify, exportJson, importJson }),
    [follows, isFollowedOn, toggle, remove, setNotify, exportJson, importJson],
  );

  return <FollowsContext.Provider value={value}>{children}</FollowsContext.Provider>;
}

export function useFollows(): FollowsApi {
  const ctx = useContext(FollowsContext);
  if (!ctx) throw new Error("useFollows must be used within FollowsProvider");
  return ctx;
}
