import { useState } from "react";
import { ErrorBanner, WarnBanner } from "../components/Banners";
import { EmptyState } from "../components/EmptyState";
import { MobileBoard } from "../components/MobileBoard";
import { PlatformTabs } from "../components/PlatformTabs";
import { ShortFilterControl } from "../components/ShortFilterControl";
import { TodayStrip } from "../components/TodayStrip";
import { WeekdayBoard } from "../components/WeekdayBoard";
import { addDays, isoWeek, wdOf } from "../lib/date";
import { platformCounts } from "../lib/items";
import { useShortFilterVersion } from "../lib/shortFilter";
import { GENERATED_AT, TODAY, WEEK_START } from "../store/data";
import type { Mode, Page, PlatformFilter } from "../types";

interface HomeViewProps {
  platform: PlatformFilter;
  onPlatformChange: (p: PlatformFilter) => void;
  mode: Mode;
  onRetry: () => void;
  warn: boolean;
  onWarnClose: () => void;
  onNavigate: (p: Page) => void;
}

export function HomeView({ platform, onPlatformChange, mode, onRetry, warn, onWarnClose, onNavigate }: HomeViewProps) {
  useShortFilterVersion();
  const [day, setDay] = useState<number>(() => wdOf(TODAY));
  const counts = platformCounts();
  const weekEnd = addDays(WEEK_START, 6);
  const weekRange = `${WEEK_START.getMonth() + 1}月${WEEK_START.getDate()}日 – ${weekEnd.getMonth() + 1}月${weekEnd.getDate()}日`;
  const updatedText = GENERATED_AT
    ? `数据更新于 ${new Date(GENERATED_AT).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })}`
    : "";

  return (
    <>
      {warn ? <WarnBanner onClose={onWarnClose} /> : null}
      {mode === "error" ? <ErrorBanner onRetry={onRetry} /> : null}
      <div className="page-head">
        <div>
          <h1>更新看板</h1>
          <div className="sub">
            {weekRange} · 第{isoWeek(WEEK_START)}周 · {updatedText} · 数据源：哔哩哔哩 / 腾讯视频 / 优酷 / 爱奇艺
          </div>
        </div>
        <div className="board-meta">今日高亮 · 共 {counts.all} 条更新 · 点击卡片直达最新正剧集</div>
      </div>
      <TodayStrip onOpenCalendar={() => onNavigate("calendar")} />
      <div className="toolbar">
        <PlatformTabs platform={platform} mode={mode} counts={counts} onChange={onPlatformChange} />
        <ShortFilterControl />
        <div className="grow" />
        <span className="board-meta">四平台定时同步（每日 07:00 / 19:00）</span>
      </div>
      {mode === "empty" ? (
        <EmptyState title="本周暂无更新" desc="四个平台本周都没有剧集更新，试试刷新或稍后再来">
          <button className="btn primary" onClick={onRetry}>刷新</button>
        </EmptyState>
      ) : (
        <>
          <WeekdayBoard platform={platform} mode={mode} />
          <MobileBoard platform={platform} mode={mode} day={day} onDayChange={setDay} />
        </>
      )}
    </>
  );
}
