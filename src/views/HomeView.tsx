import { useState } from "react";
import { ErrorBanner, WarnBanner } from "../components/Banners";
import { EmptyState } from "../components/EmptyState";
import { MobileBoard } from "../components/MobileBoard";
import { PlatformTabs } from "../components/PlatformTabs";
import { TodayStrip } from "../components/TodayStrip";
import { WeekdayBoard } from "../components/WeekdayBoard";
import { SAMPLE_TODAY } from "../data/items";
import { wdOf } from "../lib/date";
import { platformCounts } from "../lib/items";
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
  const [day, setDay] = useState<number>(() => wdOf(SAMPLE_TODAY));
  const counts = platformCounts();

  return (
    <>
      {warn ? <WarnBanner onClose={onWarnClose} /> : null}
      {mode === "error" ? <ErrorBanner onRetry={onRetry} /> : null}
      <div className="page-head">
        <div>
          <h1>更新看板</h1>
          <div className="sub">
            7月27日 – 8月2日 · 第31周 · 数据更新于 11:05（1 小时前）· 数据源：哔哩哔哩 / 腾讯视频 / 优酷 / 爱奇艺
          </div>
        </div>
        <div className="board-meta">今日高亮 · 共 {counts.all} 条更新 · 点击卡片直达最新正剧集</div>
      </div>
      <TodayStrip onOpenCalendar={() => onNavigate("calendar")} />
      <div className="toolbar">
        <PlatformTabs platform={platform} mode={mode} counts={counts} onChange={onPlatformChange} />
        <div className="grow" />
        <span className="board-meta">示例数据 · 仅用于开发与设计验收</span>
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
