import { useEffect, useState } from "react";

/** 本地变更队列与同步状态（无 React 上下文依赖，供 stores/lib 共用） */
export type SyncKind = "follows" | "blocked" | "settings";
export type SyncOp = "upsert" | "delete";
export type SyncStatus = "disabled" | "idle" | "syncing" | "offline" | "error";

export interface PendingOp {
  kind: SyncKind;
  key: string;
  op: SyncOp;
  at: string;
}

const PENDING_KEY = "anime-calendar.sync.pending.v1";
const SETTINGS_META_KEY = "anime-calendar.settings.sync-meta.v1";

let status: SyncStatus = "disabled";
const statusListeners = new Set<() => void>();
const remoteListeners = new Set<() => void>();
const queuedListeners = new Set<() => void>();

export function getSyncStatus(): SyncStatus {
  return status;
}

export function setSyncStatus(s: SyncStatus): void {
  if (status === s) return;
  status = s;
  statusListeners.forEach((l) => l());
}

export function useSyncStatus(): SyncStatus {
  const [s, setS] = useState<SyncStatus>(getSyncStatus);
  useEffect(() => {
    const l = () => setS(getSyncStatus());
    statusListeners.add(l);
    return () => {
      statusListeners.delete(l);
    };
  }, []);
  return s;
}

/** 远端数据已写回本地（stores 订阅后从 localStorage 重新载入） */
export function onRemoteApplied(l: () => void): () => void {
  remoteListeners.add(l);
  return () => {
    remoteListeners.delete(l);
  };
}

export function emitRemoteApplied(): void {
  remoteListeners.forEach((l) => l());
}

/** 本地变更已入队（同步引擎订阅后做防抖推送） */
export function onQueued(l: () => void): () => void {
  queuedListeners.add(l);
  return () => {
    queuedListeners.delete(l);
  };
}

export function loadPending(): PendingOp[] {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (raw) {
      const p = JSON.parse(raw) as PendingOp[];
      if (Array.isArray(p)) return p;
    }
  } catch {
    /* 损坏时忽略 */
  }
  return [];
}

export function clearPending(): void {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

/** 记录一次本地变更：同 key 仅保留最新动作（删除/新增以后一次为准），并触发防抖同步 */
export function queueChange(kind: SyncKind, key: string, op: SyncOp = "upsert"): void {
  try {
    const at = new Date().toISOString();
    const next = loadPending().filter((p) => !(p.kind === kind && p.key === key));
    next.push({ kind, key, op, at });
    localStorage.setItem(PENDING_KEY, JSON.stringify(next.slice(-100)));
    queuedListeners.forEach((l) => l());
  } catch {
    /* 隐私模式等场景忽略 */
  }
}

/** 设置类变更（主题/短剧过滤/断更忽略）：记录本地侧时间戳供 LWW 合并 */
export function queueSettingsChange(): void {
  try {
    localStorage.setItem(SETTINGS_META_KEY, new Date().toISOString());
  } catch {
    /* ignore */
  }
  queueChange("settings", "global");
}

export function getSettingsMeta(): string | null {
  try {
    return localStorage.getItem(SETTINGS_META_KEY);
  } catch {
    return null;
  }
}
