import { addDays, dstr, wdOf } from "./date";
import { normTitle } from "../store/follows";
import { TODAY, WEEK_START } from "../store/data";
import type { AnimeItem, FollowMap, PlatformKey } from "../types";

/** 断更检测（迭代计划书 M5）：解析腾讯 rule 文案 → 规则日当天无更新且未完结 → 疑似断更 */
export interface RuleInfo {
  days: Set<number>;
  time?: string;
}

export interface MissedEntry {
  key: string;
  title: string;
  platform: PlatformKey;
  date: string;
  weekday: number;
  rule: string;
}

const WK: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7, 末: 6 };

export function parseRule(rule?: string | null): RuleInfo | null {
  if (!rule) return null;
  const days = new Set<number>();
  let time: string | undefined;
  let any = false;
  for (const m of rule.matchAll(/每?周([一二三四五六日天末])([^。；;0-9]{0,6}?)(\d{1,2})[:：点](\d{2})?/g)) {
    const d = WK[m[1]];
    if (d) days.add(d);
    any = true;
    for (const ch of m[2]) {
      const w = WK[ch];
      if (w) days.add(w);
    }
    if (!time) time = `${String(Number(m[3])).padStart(2, "0")}:${(m[4] ?? "00").padStart(2, "0")}`;
  }
  for (const m of rule.matchAll(/每[日天][^。；;0-9]{0,14}?(\d{1,2})[:：点](\d{2})?/g)) {
    for (let d = 1; d <= 7; d++) days.add(d);
    any = true;
    if (!time) time = `${String(Number(m[1])).padStart(2, "0")}:${(m[2] ?? "00").padStart(2, "0")}`;
  }
  if (!any || !days.size) return null;
  return { days, time };
}

interface RuleHit {
  platform: PlatformKey;
  rule: string | null;
  finished: boolean;
}

function ruleFor(follow: { key: string; platforms: { platform: PlatformKey }[] }, items: AnimeItem[]): RuleHit | null {
  for (const p of follow.platforms) {
    const it = items.find((i) => i.platform === p.platform && normTitle(i.title) === follow.key && !i.predicted);
    if (!it) continue;
    const finished = !!it.finished || /大结局|完结|已完结/.test(`${it.episode ?? ""} ${it.rule ?? ""} ${it.badge ?? ""}`);
    return { platform: p.platform, rule: it.rule ?? null, finished };
  }
  return null;
}

/** 某一天疑似断更的追番（有规则、规则日匹配、当天无更新、未完结、未被忽略） */
export function missedOn(date: Date, follows: FollowMap, items: AnimeItem[], ignore: Set<string>): MissedEntry[] {
  const wd = wdOf(date);
  const ds = dstr(date);
  const weekStart = dstr(WEEK_START);
  const out: MissedEntry[] = [];
  for (const f of Object.values(follows)) {
    const info = ruleFor(f, items);
    if (!info || !info.rule || info.finished) continue;
    const rule = parseRule(info.rule);
    if (!rule || !rule.days.has(wd)) continue;
    const has = items.some((i) => i.platform === info.platform && normTitle(i.title) === f.key && i.date === ds);
    if (has) continue;
    // SVIP 抢先剧（如「每周日18点SVIP抢先看，周二10点更新」）：周表只展示 SVIP 抢先日条目，
    // VIP 常规日无条目属预期（同一集已提前更新）；本周内已有该剧任意更新即不算断更，
    // 与 SVIP/VIP 日期先后顺序无关（抢先日可能落在上周日，周表只覆盖本周一~周日）。
    if (/SVIP|抢先/.test(info.rule)) {
      const hasAnyThisWeek = items.some(
        (i) => i.platform === info.platform && normTitle(i.title) === f.key && i.date >= weekStart && i.date <= dstr(TODAY),
      );
      if (hasAnyThisWeek) continue;
    }
    const ig = `${f.key}:${ds}`;
    if (ignore.has(ig)) continue;
    out.push({ key: f.key, title: f.title, platform: info.platform, date: ds, weekday: wd, rule: info.rule });
  }
  return out;
}

/** 本周（周一~今天）全部疑似断更条目，供追番列表聚合展示 */
export function missedWeek(follows: FollowMap, items: AnimeItem[], ignore: Set<string>): MissedEntry[] {
  const out: MissedEntry[] = [];
  const end = TODAY;
  for (let d = WEEK_START; d <= end; d = addDays(d, 1)) {
    out.push(...missedOn(d, follows, items, ignore));
  }
  return out;
}

export const missKey = (key: string, date: string) => `${key}:${date}`;
