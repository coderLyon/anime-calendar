import { dstr } from "./date";
import { itemsOn } from "./items";
import { normTitle } from "../store/follows";
import { TODAY } from "../store/data";
import { logNotified } from "./sync";
import type { AnimeItem, FollowMap } from "../types";

/** 站内/浏览器更新提醒（迭代计划书 M5）：同一剧集同一天只提醒一次 */
const NOTIFIED_KEY = "anime-calendar.notified.v1";

export function readNotified(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(NOTIFIED_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Record<string, string[]>;
      if (p && typeof p === "object") return p;
    }
  } catch {
    /* 损坏忽略 */
  }
  return {};
}

export function markNotified(date: string, keys: string[]): void {
  try {
    const map = readNotified();
    const list = new Set(map[date] ?? []);
    keys.forEach((k) => list.add(k));
    map[date] = [...list].slice(-500);
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/** 今日已追番且未关闭逐剧提醒的条目（角标计数） */
export function todayFollowedNotifyItems(follows: FollowMap): AnimeItem[] {
  return itemsOn(TODAY, "all").filter((i) => {
    const f = follows[normTitle(i.title)];
    return !!f && (f.notify ?? true);
  });
}

function timePassed(updateTime?: string): boolean {
  if (!updateTime) return true;
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return updateTime <= `${hh}:${mm}`;
}

/** 需要触发浏览器通知的条目：更新时间已到（或未知）且当天未提醒过 */
export function pendingNotifications(follows: FollowMap): AnimeItem[] {
  const date = dstr(TODAY);
  const done = new Set(readNotified()[date] ?? []);
  return todayFollowedNotifyItems(follows).filter((i) => timePassed(i.updateTime) && !done.has(normTitle(i.title)));
}

/** 聚合提醒一次；返回触发条数（未授权/已提醒过返回 0） */
export function showTodayNotifications(follows: FollowMap): number {
  if (typeof window === "undefined" || typeof Notification === "undefined" || Notification.permission !== "granted") return 0;
  const items = pendingNotifications(follows);
  if (!items.length) return 0;
  const date = dstr(TODAY);
  const titles = [...new Set(items.map((i) => i.title))];
  const body = `《${titles.slice(0, 3).join("》《")}》${titles.length > 3 ? `等 ${titles.length} 部` : ""}`;
  try {
    const n = new Notification(`今日 ${items.length} 部追番更新`, {
      body,
      icon: "/anime-calendar/pwa-192.png",
      tag: `anime-today-${date}`,
    });
    n.onclick = () => {
      window.focus();
    };
  } catch {
    return 0;
  }
  const keys = items.map((i) => normTitle(i.title));
  markNotified(date, keys);
  keys.forEach((k) => void logNotified(date, k));
  return items.length;
}
