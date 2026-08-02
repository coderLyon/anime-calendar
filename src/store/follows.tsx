import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { onRemoteApplied, queueChange } from "../lib/syncQueue";
import type { AnimeItem, FollowMap } from "../types";

const FOLLOWS_KEY = "anime-calendar.follows.v1";

export function normTitle(t: string): string {
  return t.replace(/[·．\s:：]/g, "").toLowerCase();
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
  isFollowed: (title: string) => boolean;
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

  const isFollowed = useCallback((title: string) => !!follows[normTitle(title)], [follows]);

  const toggle = useCallback((item: AnimeItem) => {
    const key = normTitle(item.title);
    setFollows((prev) => {
      const existing = prev[key];
      if (existing) {
        const next = { ...prev };
        delete next[key];
        queueChange("follows", key, "delete");
        return next;
      }
      queueChange("follows", key, "upsert");
      return {
        ...prev,
        [key]: {
          key,
          title: item.title,
          platforms: [{ platform: item.platform, episode: item.episode, updateTime: item.updateTime, url: item.url ?? "#" }],
          followedAt: new Date().toISOString().slice(0, 10),
          updatedAt: new Date().toISOString(),
          notify: true,
        },
      };
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
    () => ({ follows, count: Object.keys(follows).length, isFollowed, toggle, remove, setNotify, exportJson, importJson }),
    [follows, isFollowed, toggle, remove, setNotify, exportJson, importJson],
  );

  return <FollowsContext.Provider value={value}>{children}</FollowsContext.Provider>;
}

export function useFollows(): FollowsApi {
  const ctx = useContext(FollowsContext);
  if (!ctx) throw new Error("useFollows must be used within FollowsProvider");
  return ctx;
}
