import { ensureSession, getClient, isSupabaseEnabled } from "./supabase";
import { clearPending, emitRemoteApplied, getSettingsMeta, loadPending, onQueued, setSyncStatus } from "./syncQueue";
import { getShortFilter, setShortFilter } from "./shortFilter";
import { applyRemoteTheme, loadTheme } from "../store/theme";
import type { Theme } from "../store/theme";
import type { BlockedItem, BlockedMap, FollowItem, FollowMap } from "../types";

/**
 * 匿名云同步引擎（迭代计划书 M5）：
 * - 本地优先（offline-first）：localStorage 是即时数据源，写操作先入队；
 * - 合并策略：记录级 last-write-wins（updated_at / deleted_at 取较大者）；
 * - 删除同步：pending 队列里的 delete 转成 deleted_at 墓碑行，跨设备收敛；
 * - 未配置 Supabase 时整体禁用，站点行为与纯本地一致。
 */

const FOLLOWS_KEY = "anime-calendar.follows.v1";
const BLOCKED_KEY = "anime-calendar.blocked.v1";
const IGNORE_KEY = "anime-calendar.ignore-missed.v1";
const SETTINGS_KEY = "global";
const MAX_ROWS = 2000;
const EPOCH = "1970-01-01T00:00:00.000Z";

export interface SyncRow {
  key: string;
  updated_at: string | null;
  deleted_at: string | null;
  [k: string]: unknown;
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const p = JSON.parse(raw) as T;
      if (p && typeof p === "object") return p;
    }
  } catch {
    /* 损坏数据忽略 */
  }
  return fallback;
}

function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

const tsOf = (r: SyncRow | null | undefined): string => r?.deleted_at ?? r?.updated_at ?? EPOCH;

async function pullRows(table: string): Promise<SyncRow[]> {
  const c = getClient();
  if (!c) return [];
  const { data, error } = await c.from(table).select("*").limit(MAX_ROWS);
  if (error) throw error;
  return (data ?? []) as SyncRow[];
}

async function upsertRows(table: string, rows: unknown[]): Promise<void> {
  const c = getClient();
  if (!c || !rows.length) return;
  const { error } = await c.from(table).upsert(rows, { onConflict: "user_id,key" });
  if (error) throw error;
}

function readFollows(): FollowMap {
  return readJSON<FollowMap>(FOLLOWS_KEY, {});
}

function readBlocked(): BlockedMap {
  return readJSON<BlockedMap>(BLOCKED_KEY, {});
}

export function readIgnoreMissed(): string[] {
  const v = readJSON<string[]>(IGNORE_KEY, []);
  return Array.isArray(v) ? v : [];
}

export function writeIgnoreMissed(list: string[]): void {
  writeJSON(IGNORE_KEY, list);
}

const localFollowAt = (f: FollowItem): string =>
  f.updatedAt ?? (f.followedAt ? new Date(`${f.followedAt}T00:00:00Z`).toISOString() : EPOCH);

const localBlockedAt = (b: BlockedItem): string =>
  b.blockedAt ? new Date(`${b.blockedAt}T00:00:00Z`).toISOString() : EPOCH;

function toLocalFollow(r: SyncRow): FollowItem {
  return {
    key: r.key,
    title: String(r.title ?? ""),
    platforms: Array.isArray(r.platforms) ? (r.platforms as FollowItem["platforms"]) : [],
    followedAt: (r.followed_at as string) ?? undefined,
    updatedAt: r.updated_at ?? undefined,
  };
}

function pendingDeletes(kind: "follows" | "blocked"): Map<string, string> {
  const del = new Map<string, string>();
  for (const p of loadPending()) {
    if (p.kind !== kind || p.op !== "delete") continue;
    const prev = del.get(p.key);
    if (!prev || p.at > prev) del.set(p.key, p.at);
  }
  return del;
}

export interface FollowMergeResult {
  next: FollowMap;
  deletes: Map<string, string>;
}

/** 纯合并（单测覆盖）：本地 + 远端 + 删除墓碑 → 记录级 LWW */
export function mergeFollows(local: FollowMap, remote: SyncRow[], delOps: Map<string, string>): FollowMergeResult {
  const keys = new Set<string>([...Object.keys(local), ...remote.map((r) => r.key), ...delOps.keys()]);
  const merged = new Map<string, { follow?: FollowItem; delAt?: string }>();

  for (const key of keys) {
    const l = local[key];
    const r = remote.find((x) => x.key === key) ?? null;
    const lDel = delOps.get(key);
    let at = l ? localFollowAt(l) : EPOCH;
    let state: "local" | "localDel" | "remote" | "remoteDel" = l ? "local" : "localDel";
    if (lDel && lDel > at) {
      at = lDel;
      state = "localDel";
    }
    if (r && tsOf(r) > at) {
      at = tsOf(r);
      state = r.deleted_at ? "remoteDel" : "remote";
    }
    if (state === "localDel" || state === "remoteDel") merged.set(key, { delAt: at });
    else if (state === "remote" && r) merged.set(key, { follow: toLocalFollow(r) });
    else if (l) merged.set(key, { follow: l });
  }

  const next: FollowMap = {};
  const deletes = new Map<string, string>();
  for (const [key, v] of merged) {
    if (v.follow) next[key] = v.follow;
    else if (v.delAt) deletes.set(key, v.delAt);
  }
  return { next, deletes };
}

async function syncFollows(userId: string): Promise<void> {
  const remote = await pullRows("follows");
  const local = readFollows();
  const { next, deletes } = mergeFollows(local, remote, pendingDeletes("follows"));
  writeJSON(FOLLOWS_KEY, next);
  emitRemoteApplied();

  const rows: unknown[] = [];
  for (const [key, f] of Object.entries(next)) {
    rows.push({
      user_id: userId,
      key,
      title: f.title,
      platforms: JSON.stringify(f.platforms),
      followed_at: f.followedAt ?? null,
      updated_at: localFollowAt(f),
      deleted_at: null,
    });
  }
  for (const [key, at] of deletes) {
    rows.push({ user_id: userId, key, title: "", platforms: "[]", updated_at: at, deleted_at: at });
  }
  await upsertRows("follows", rows);
}

export interface BlockedMergeResult {
  next: BlockedMap;
  deletes: Map<string, string>;
}

export function mergeBlocked(local: BlockedMap, remote: SyncRow[], delOps: Map<string, string>): BlockedMergeResult {
  const keys = new Set<string>([...Object.keys(local), ...remote.map((r) => r.key), ...delOps.keys()]);
  const merged = new Map<string, { item?: BlockedItem; delAt?: string }>();

  for (const key of keys) {
    const l = local[key];
    const r = remote.find((x) => x.key === key) ?? null;
    const lDel = delOps.get(key);
    let at = l ? localBlockedAt(l) : EPOCH;
    let state: "local" | "localDel" | "remote" | "remoteDel" = l ? "local" : "localDel";
    if (lDel && lDel > at) {
      at = lDel;
      state = "localDel";
    }
    if (r && tsOf(r) > at) {
      at = tsOf(r);
      state = r.deleted_at ? "remoteDel" : "remote";
    }
    if (state === "localDel" || state === "remoteDel") merged.set(key, { delAt: at });
    else if (state === "remote" && r) {
      merged.set(key, {
        item: { key, title: String(r.title ?? ""), blockedAt: (r.blocked_at as string) ?? undefined },
      });
    } else if (l) merged.set(key, { item: l });
  }

  const next: BlockedMap = {};
  const deletes = new Map<string, string>();
  for (const [key, v] of merged) {
    if (v.item) next[key] = v.item;
    else if (v.delAt) deletes.set(key, v.delAt);
  }
  return { next, deletes };
}

async function syncBlocked(userId: string): Promise<void> {
  const remote = await pullRows("blocked");
  const local = readBlocked();
  const { next, deletes } = mergeBlocked(local, remote, pendingDeletes("blocked"));
  writeJSON(BLOCKED_KEY, next);
  emitRemoteApplied();

  const rows: unknown[] = [];
  for (const [key, item] of Object.entries(next)) {
    rows.push({
      user_id: userId,
      key,
      title: item.title,
      blocked_at: item.blockedAt ?? null,
      updated_at: localBlockedAt(item),
      deleted_at: null,
    });
  }
  for (const [key, at] of deletes) {
    rows.push({ user_id: userId, key, title: "", updated_at: at, deleted_at: at });
  }
  await upsertRows("blocked", rows);
}

function localSettingsRow(userId: string): Record<string, unknown> {
  const sf = getShortFilter();
  return {
    user_id: userId,
    key: SETTINGS_KEY,
    theme: loadTheme(),
    shortfilter_enabled: sf.enabled,
    shortfilter_threshold: sf.thresholdSec,
    ignore_missed: JSON.stringify(readIgnoreMissed()),
    updated_at: getSettingsMeta() ?? new Date().toISOString(),
    deleted_at: null,
  };
}

async function syncSettings(userId: string): Promise<void> {
  const remote = await pullRows("settings");
  const r = remote.find((x) => x.key === SETTINGS_KEY) ?? null;
  const localAt = getSettingsMeta() ?? new Date().toISOString();
  let row: Record<string, unknown>;

  if (r && tsOf(r) > localAt) {
    if (r.deleted_at) {
      row = { user_id: userId, key: SETTINGS_KEY, updated_at: tsOf(r), deleted_at: r.deleted_at };
    } else {
      const theme = r.theme as Theme | null;
      if (theme === "light" || theme === "dark") applyRemoteTheme(theme);
      if (typeof r.shortfilter_enabled === "boolean" && typeof r.shortfilter_threshold === "number") {
        setShortFilter({ enabled: r.shortfilter_enabled, thresholdSec: r.shortfilter_threshold });
      }
      if (Array.isArray(r.ignore_missed)) writeIgnoreMissed(r.ignore_missed as string[]);
      emitRemoteApplied();
      row = {
        user_id: userId,
        key: SETTINGS_KEY,
        theme: r.theme ?? null,
        shortfilter_enabled: r.shortfilter_enabled ?? null,
        shortfilter_threshold: r.shortfilter_threshold ?? null,
        ignore_missed: JSON.stringify(Array.isArray(r.ignore_missed) ? r.ignore_missed : []),
        updated_at: tsOf(r),
        deleted_at: null,
      };
    }
  } else {
    row = localSettingsRow(userId);
  }
  await upsertRows("settings", [row]);
}

/** 通知去重日志（仅推送，跨设备同一剧集同一天只提醒一次） */
export async function logNotified(date: string, showKey: string): Promise<void> {
  const c = getClient();
  if (!c) return;
  try {
    const { user } = await ensureSession();
    if (!user) return;
    await c.from("notify_log").upsert(
      { user_id: user.id, date, show_key: showKey, notified_at: new Date().toISOString() },
      { onConflict: "user_id,date,show_key" },
    );
  } catch {
    /* 去重日志失败不影响提醒本身 */
  }
}

let timer: number | undefined;

export function scheduleSync(delay = 1200): void {
  if (!isSupabaseEnabled()) return;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    void syncAll();
  }, delay);
}

let inited = false;

export function initSync(): void {
  if (inited) return;
  inited = true;
  if (!isSupabaseEnabled()) {
    setSyncStatus("disabled");
    return;
  }
  onQueued(() => scheduleSync());
  void syncAll();
}

export async function syncAll(): Promise<void> {
  if (!isSupabaseEnabled()) {
    setSyncStatus("disabled");
    return;
  }
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    setSyncStatus("offline");
    return;
  }
  setSyncStatus("syncing");
  try {
    const { user, error } = await ensureSession();
    if (error || !user) {
      setSyncStatus(error ? "error" : "idle");
      return;
    }
    await syncFollows(user.id);
    await syncBlocked(user.id);
    await syncSettings(user.id);
    clearPending();
    setSyncStatus("idle");
  } catch (e) {
    console.error("[sync]", e);
    setSyncStatus(typeof navigator !== "undefined" && navigator.onLine ? "error" : "offline");
  }
}
