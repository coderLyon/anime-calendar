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
  /** 更新规则文案：腾讯每日更新卡片提供（如「每周四、五、六、日各更新1集」）；其余平台规则见剧集简介，暂不入库 */
  rule?: string;
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
}

export type FollowMap = Record<string, FollowItem>;
export type PlatformFilter = PlatformKey | "all";
export type Page = "home" | "follow" | "calendar";
export type Mode = "normal" | "skeleton" | "error" | "empty";
export type CalView = "schedule" | "week" | "month";
export type CalScope = "follow" | "all";
