/** 与 M1 数据管道（scripts/sync.mjs）输出同构的数据契约。 */

export type PlatformKey = "bili" | "tencent" | "youku" | "iqiyi";

export interface AnimeItem {
  id: string;
  platform: PlatformKey;
  title: string;
  /** 真实海报 URL；示例数据为空，由 CSS 渐变占位 */
  poster?: string;
  episode: string;
  /** "HH:MM" */
  updateTime: string;
  /** "YYYY-MM-DD" */
  date: string;
  /** 1..7（周一=1），与 date 一致 */
  weekday: number;
  svip: boolean;
  /** 最新正剧集直达链接（清洗层黑名单过滤后解析） */
  url?: string;
  /** 独播 / 限免 / SVIP抢先 等 */
  badge?: string | null;
  /** 秒；<300（不足 5 分钟）会被清洗层丢弃 */
  duration?: number;
  /**
   * 更新规则文案：腾讯卡片原文；B站取季接口 new_ep.desc（如「连载中, 每周一、六 9:00更新」）；
   * 优酷/爱奇艺按星期 Tab 排期推导（如「每周二更新」/「每日更新」）。
   */
  rule?: string;
  /** 总集数：B站 season API total / 优酷 episodeTotal / 爱奇艺 avlistinfo total / 腾讯「全N集」文案 */
  total?: number;
  /** 已完结：大结局/全X集 等标记，不参与下周排期预测 */
  finished?: boolean;
  /** 预测排期：由本周更新 +7 天推导的下一周条目（非平台原始数据） */
  predicted?: boolean;
}

export interface PlatformResult {
  platform: PlatformKey;
  label: string;
  items: AnimeItem[];
  error?: string | null;
  warnings?: string[];
  fetchedAt: string;
}

export interface UpdatesFile {
  generatedAt: string;
  platforms: PlatformResult[];
}

export interface FollowPlatform {
  platform: PlatformKey;
  url: string;
  episode: string;
  updateTime?: string;
}

export interface FollowItem {
  /** 规范化标题（去 ·/空格/冒号，小写），跨平台合并键 */
  key: string;
  title: string;
  platforms: FollowPlatform[];
  followedAt: string;
  /** 最近一次变更时间（ISO），云同步 LWW 合并用；旧数据缺省时用 followedAt */
  updatedAt?: string;
  /** 追番时的海报 URL（历史收藏可能不在当前周数据，靠它兜底展示封面） */
  poster?: string;
  /** 逐剧更新提醒开关（默认开启，缺省视为 true） */
  notify?: boolean;
}

export type FollowMap = Record<string, FollowItem>;
export type PlatformFilter = PlatformKey | "all";
export type Page = "home" | "follow" | "calendar";
export type Mode = "normal" | "skeleton" | "error" | "empty";
export type CalView = "schedule" | "week" | "month";
export type CalScope = "follow" | "all";

export interface BlockedItem {
  key: string;
  title: string;
  blockedAt: string;
}

export type BlockedMap = Record<string, BlockedItem>;

/** data/history.json：多周导航的历史归档（真实条目，不含 predicted） */
export interface HistoryWeek {
  weekStart: string;
  items: AnimeItem[];
}

export interface HistoryFile {
  updatedAt: string | null;
  weeks: HistoryWeek[];
}
