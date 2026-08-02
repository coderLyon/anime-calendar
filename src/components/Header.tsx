import { CalendarIcon, MoonIcon, RefreshIcon, StarIcon, SunIcon } from "../lib/icons";
import type { Theme } from "../store/theme";
import type { Page } from "../types";
import { NotificationBell } from "./NotificationBell";
import { SyncStatus } from "./SyncStatus";

interface HeaderProps {
  page: Page;
  followCount: number;
  theme: Theme;
  onNavigate: (p: Page) => void;
  onToggleTheme: () => void;
  onRefresh: () => void;
}

export function Header({ page, followCount, theme, onNavigate, onToggleTheme, onRefresh }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="container header-inner">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            onNavigate("home");
          }}
          aria-label="回到看板"
        >
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <rect x="3" y="4.5" width="18" height="16.5" rx="3" />
              <path d="M3 9h18M8 2.8v3.4M16 2.8v3.4" />
              <path d="m8.4 13.5 2.4 2.4 4.8-5" />
            </svg>
          </span>
          <span className="brand-text">
            <span className="brand-name">追番日历</span>
            <span className="brand-sub">动漫更新看板</span>
          </span>
        </a>
        <div className="header-actions">
          <SyncStatus />
          <NotificationBell />
          <button className="icon-btn" title={theme === "dark" ? "切换浅色模式" : "切换深色模式"} onClick={onToggleTheme}>
            <MoonIcon className="ic-moon" />
            <SunIcon className="ic-sun" />
          </button>
          <button className="btn ghost" onClick={onRefresh}>
            <RefreshIcon />
            <span>刷新</span>
          </button>
          <button className={`btn ghost ${page === "calendar" ? "active-nav" : ""}`} onClick={() => onNavigate("calendar")}>
            <CalendarIcon />
            <span>追番日历</span>
          </button>
          <button className="btn primary-soft" onClick={() => onNavigate("follow")}>
            <StarIcon className="star-fill" />
            <span>追番</span>
            <span className="count-pill">{followCount}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
