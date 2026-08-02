import { useEffect, useRef, useState } from "react";
import { ErrorBanner, WarnBanner } from "../components/Banners";
import { EmptyState } from "../components/EmptyState";
import { FilterChips } from "../components/FilterChips";
import { MobileBoard } from "../components/MobileBoard";
import { PlatformTabs } from "../components/PlatformTabs";
import { SearchBox } from "../components/SearchBox";
import { ShortFilterControl } from "../components/ShortFilterControl";
import { TodayStrip } from "../components/TodayStrip";
import { WeekNav } from "../components/WeekNav";
import { WeekdayBoard } from "../components/WeekdayBoard";
import { addDays, dstr, isoWeek, relativeTime, wdOf } from "../lib/date";
import { applyFilters, type BadgeKey, type ItemFilters } from "../lib/filters";
import { loadHistoryFile } from "../lib/history";
import { itemsOn, platformCounts } from "../lib/items";
import { applyShortFilter, useShortFilterVersion } from "../lib/shortFilter";
import { GENERATED_AT, TODAY, WEEK_START, useDataVersion } from "../store/data";
import type { HistoryFile, Mode, Page, PlatformFilter } from "../types";

interface HomeViewProps {
  platform: PlatformFilter;
  onPlatformChange: (p: PlatformFilter) => void;
  mode: Mode;
  onRetry: () => void;
  warn: boolean;
  onWarnClose: () => void;
  onNavigate: (p: Page) => void;
}

const WEEK_MIN = -8;
const WEEK_MAX = 1;

function param(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}

function clampWeek(n: number): number {
  return Math.max(WEEK_MIN, Math.min(WEEK_MAX, n));
}

export function HomeView({ platform, onPlatformChange, mode, onRetry, warn, onWarnClose, onNavigate }: HomeViewProps) {
  useDataVersion();
  useShortFilterVersion();
  const [day, setDay] = useState<number>(() => {
    const d = Number(param("day"));
    return d >= 1 && d <= 7 ? d : wdOf(TODAY);
  });
  const [weekOffset, setWeekOffset] = useState<number>(() => clampWeek(Number(param("week") ?? "0") || 0));
  const [query, setQuery] = useState<string>(() => {
    try {
      return decodeURIComponent(param("show") ?? "");
    } catch {
      return "";
    }
  });
  const [badges, setBadges] = useState<Set<BadgeKey>>(new Set());
  const [ongoingOnly, setOngoingOnly] = useState(false);
  const [hist, setHist] = useState<HistoryFile | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const counts = platformCounts();
  const filters: ItemFilters = { query, badges, ongoingOnly };
  const weekStart = addDays(WEEK_START, weekOffset * 7);
  const weekEnd = addDays(weekStart, 6);
  const weekRange = `${weekStart.getMonth() + 1}月${weekStart.getDate()}日 – ${weekEnd.getMonth() + 1}月${weekEnd.getDate()}日`;

  useEffect(() => {
    if (weekOffset < 0) void loadHistoryFile().then(setHist);
  }, [weekOffset]);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    sp.set("p", "home");
    sp.set("platform", platform);
    sp.set("week", String(weekOffset));
    sp.set("day", String(day));
    if (query) sp.set("show", query);
    else sp.delete("show");
    window.history.replaceState(null, "", `${window.location.pathname}?${sp.toString()}`);
  }, [platform, weekOffset, day, query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? "").toUpperCase();
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const historyItemsOn = (date: Date) => {
    const ds = dstr(date);
    const wk = hist?.weeks.find((w) => w.weekStart === dstr(weekStart));
    const list = wk ? wk.items.filter((i) => i.date === ds && (platform === "all" || i.platform === platform)) : [];
    return applyShortFilter(list);
  };

  const boardItems = (date: Date) => (weekOffset < 0 ? historyItemsOn(date) : itemsOn(date, platform));

  const matchedTotal = Array.from({ length: 7 }, (_, i) => applyFilters(boardItems(addDays(weekStart, i)), filters).length).reduce((a, b) => a + b, 0);
  const weekMissing = weekOffset < 0 && !!hist && !hist.weeks.some((w) => w.weekStart === dstr(weekStart));
  const updatedAt = GENERATED_AT ? new Date(GENERATED_AT).toLocaleString("zh-CN", { hour12: false }) : "";

  return (
    <>
      {warn ? <WarnBanner onClose={onWarnClose} /> : null}
      {mode === "error" ? <ErrorBanner onRetry={onRetry} /> : null}
      <div className="page-head">
        <div>
          <h1>更新看板</h1>
          <div className="sub">
            {weekRange} · 第{isoWeek(weekStart)}周 · 数据更新于 {relativeTime(GENERATED_AT)}
            <span title={updatedAt}>（{updatedAt}）</span> · 数据源：哔哩哔哩 / 腾讯视频 / 优酷 / 爱奇艺
          </div>
          <div className="board-meta">今日高亮 · 共 {counts.all} 条更新 · 点击卡片直达最新正剧集</div>
        </div>
        <WeekNav offset={weekOffset} min={WEEK_MIN} max={WEEK_MAX} onChange={setWeekOffset} />
      </div>
      {weekOffset === 0 ? <TodayStrip platform={platform} filters={filters} onOpenCalendar={() => onNavigate("calendar")} /> : null}
      <div className="toolbar">
        <PlatformTabs platform={platform} mode={mode} counts={counts} onChange={onPlatformChange} />
        <ShortFilterControl />
        <div className="grow" />
        <span className="board-meta">四平台定时同步（每日 07:00 / 19:00）</span>
      </div>
      <div className="toolbar filter-bar">
        <SearchBox value={query} onChange={setQuery} inputRef={searchRef} />
        <FilterChips badges={badges} ongoingOnly={ongoingOnly} onChange={(b, o) => { setBadges(b); setOngoingOnly(o); }} />
        <div className="grow" />
        <span className="filter-count">{query || badges.size || ongoingOnly ? `匹配 ${matchedTotal} 条` : ""}</span>
      </div>
      {weekMissing ? <div className="board-note">该周暂无历史归档数据（归档自 M5 起逐步累积），显示为空属正常。</div> : null}
      {mode === "empty" ? (
        <EmptyState title="本周暂无更新" desc="四个平台本周都没有剧集更新，试试刷新或稍后再来">
          <button className="btn primary" onClick={onRetry}>刷新</button>
        </EmptyState>
      ) : (
        <>
          <WeekdayBoard platform={platform} mode={mode} weekStart={weekStart} filters={filters} />
          <MobileBoard platform={platform} mode={mode} weekStart={weekStart} filters={filters} day={day} onDayChange={setDay} />
        </>
      )}
    </>
  );
}
