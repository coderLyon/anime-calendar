import { addDays, dstr } from "./date";
import { applyShortFilter } from "./shortFilter";
import { normTitle } from "../store/follows";
import { ITEMS, WEEK_START } from "../store/data";
import type { AnimeItem, PlatformFilter, PlatformKey } from "../types";

/**
 * 数据访问层（M0 使用示例数据）。
 * M1 起改为加载 data/updates.json（结构与 AnimeItem 契约一致），本层接口保持不变。
 */
export function itemsFor(platform: PlatformFilter): AnimeItem[] {
  const base = platform === "all" ? ITEMS : ITEMS.filter((i) => i.platform === platform);
  return applyShortFilter(base);
}

export function itemsOn(date: Date, platform: PlatformFilter): AnimeItem[] {
  const ds = dstr(date);
  return itemsFor(platform)
    .filter((i) => i.date === ds)
    .sort((a, b) => a.updateTime.localeCompare(b.updateTime));
}

/** 追番日历专用：不受短剧过滤/屏蔽影响，展示原始全部条目（用户确认的语义） */
export function calendarItemsOn(date: Date, platform: PlatformFilter): AnimeItem[] {
  const ds = dstr(date);
  return ITEMS.filter((i) => i.date === ds && (platform === "all" || i.platform === platform)).sort((a, b) =>
    a.updateTime.localeCompare(b.updateTime),
  );
}

/** 本周真实更新总数（不受短剧过滤/屏蔽影响），用于看板描述「共 N 条更新」 */
export function rawWeekTotal(): number {
  const weekStart = dstr(WEEK_START);
  const weekEnd = dstr(addDays(WEEK_START, 6));
  return ITEMS.filter((i) => !i.predicted && i.date >= weekStart && i.date <= weekEnd).length;
}

/** 按标题+平台从当前数据补全追番列表展示信息（解决历史收藏缺更新时间/链接过期） */
export function platformInfoFor(
  title: string,
  platform: PlatformKey,
): { episode: string; updateTime: string; url?: string; rule?: string; total?: number } | null {
  const k = normTitle(title);
  const it = ITEMS.find((i) => !i.predicted && i.platform === platform && normTitle(i.title) === k);
  if (!it) return null;
  return { episode: it.episode, updateTime: it.updateTime ?? "", url: it.url, rule: it.rule, total: it.total };
}

export function platformCounts(): Record<PlatformFilter, number> {
  // 看板计数仅统计本周（预测的下一周条目不计入，避免翻倍）
  const weekStart = dstr(WEEK_START);
  const weekEnd = dstr(addDays(WEEK_START, 6));
  const filtered = applyShortFilter(ITEMS).filter((i) => i.date >= weekStart && i.date <= weekEnd);
  const counts: Record<PlatformFilter, number> = { all: filtered.length, bili: 0, tencent: 0, youku: 0, iqiyi: 0 };
  for (const item of filtered) counts[item.platform]++;
  return counts;
}

/** 按标题找当前周数据的海报（追番列表等未持久化海报的场景使用） */
export function posterForTitle(title: string): string | undefined {
  const norm = (t: string) => t.replace(/[·．\s:：]/g, "").toLowerCase();
  const k = norm(title);
  return ITEMS.find((i) => norm(i.title) === k)?.poster;
}

/** 时长展示：不足 60s 显示秒，否则约 N 分钟（M5 信息增强） */
export function formatDuration(sec?: number | null): string | null {
  if (sec == null || sec <= 0) return null;
  if (sec < 60) return `约${Math.round(sec)}秒`;
  return `约${Math.round(sec / 60)}分钟`;
}

/** 总集数展示：B站/优酷用「话」，腾讯/爱奇艺用「集」 */
export function formatTotal(item: { platform: PlatformKey; total?: number | null }): string | null {
  const n = Number(item.total);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = item.platform === "bili" || item.platform === "youku" ? "话" : "集";
  return `共${n}${unit}`;
}
