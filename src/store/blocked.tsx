import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { setBlockedTitles } from "../lib/shortFilter";
import { onRemoteApplied, queueChange } from "../lib/syncQueue";
import type { BlockedMap } from "../types";

const BLOCKED_KEY = "anime-calendar.blocked.v1";

export function normKey(t: string): string {
  return String(t).replace(/[·：\s-]/g, "").toLowerCase();
}

function loadBlocked(): BlockedMap {
  try {
    const raw = localStorage.getItem(BLOCKED_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as BlockedMap;
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch {
    /* 忽略损坏数据，从空开始 */
  }
  return {};
}

interface BlockedApi {
  blocked: BlockedMap;
  count: number;
  isBlocked: (title: string) => boolean;
  toggle: (title: string) => void;
  remove: (key: string) => void;
}

const BlockedContext = createContext<BlockedApi | null>(null);

const initialBlocked = typeof localStorage !== "undefined" ? loadBlocked() : {};
setBlockedTitles(Object.keys(initialBlocked));

export function BlockedProvider({ children }: { children: ReactNode }) {
  const [blocked, setBlocked] = useState<BlockedMap>(initialBlocked);

  useEffect(() => {
    try {
      localStorage.setItem(BLOCKED_KEY, JSON.stringify(blocked));
    } catch {
      /* 隐私模式等场景忽略 */
    }
    setBlockedTitles(Object.keys(blocked));
  }, [blocked]);

  useEffect(
    () =>
      onRemoteApplied(() => {
        setBlocked(loadBlocked());
      }),
    [],
  );

  const isBlocked = useCallback((title: string) => !!blocked[normKey(title)], [blocked]);

  const toggle = useCallback((title: string) => {
    const key = normKey(title);
    setBlocked((prev) => {
      if (prev[key]) {
        queueChange("blocked", key, "delete");
        const next = { ...prev };
        delete next[key];
        return next;
      }
      queueChange("blocked", key, "upsert");
      return {
        ...prev,
        [key]: { key, title, blockedAt: new Date().toISOString().slice(0, 10) },
      };
    });
  }, []);

  const remove = useCallback((key: string) => {
    queueChange("blocked", key, "delete");
    setBlocked((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const value = useMemo<BlockedApi>(
    () => ({ blocked, count: Object.keys(blocked).length, isBlocked, toggle, remove }),
    [blocked, isBlocked, toggle, remove],
  );

  return <BlockedContext.Provider value={value}>{children}</BlockedContext.Provider>;
}

export function useBlocked(): BlockedApi {
  const ctx = useContext(BlockedContext);
  if (!ctx) throw new Error("useBlocked must be used within BlockedProvider");
  return ctx;
}
