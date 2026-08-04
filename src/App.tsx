import { useCallback, useEffect, useState } from "react";
import { Header } from "./components/Header";
import { useToast } from "./components/Toast";
import { loadTheme, saveTheme, type Theme } from "./store/theme";
import { useFollows } from "./store/follows";
import { refreshFromRemote } from "./store/data";
import { initSync, syncAll } from "./lib/sync";
import { queueSettingsChange } from "./lib/syncQueue";
import { showTodayNotifications } from "./lib/notify";
import type { Mode, Page, PlatformFilter } from "./types";

const WARN_DISMISS_KEY = "anime-calendar.warn-dismissed.v1";
import { CalendarView } from "./views/CalendarView";
import { FollowView } from "./views/FollowView";
import { HomeView } from "./views/HomeView";

function param(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}

export function App() {
  const toast = useToast();
  const { count, follows } = useFollows();
  const [page, setPage] = useState<Page>(() => {
    const p = param("p");
    return p === "follow" || p === "calendar" ? p : "home";
  });
  const [platform, setPlatform] = useState<PlatformFilter>("all");
  const [mode, setMode] = useState<Mode>(() => {
    const s = param("state");
    return s === "skeleton" || s === "error" || s === "empty" ? s : "normal";
  });
  const [warn, setWarn] = useState<boolean>(() => {
    if (param("warn") === "0") return false;
    try {
      return localStorage.getItem(WARN_DISMISS_KEY) !== "1";
    } catch {
      return true;
    }
  });
  const [theme, setTheme] = useState<Theme>(() => {
    const t = param("theme");
    return t === "dark" || t === "light" ? t : loadTheme();
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    saveTheme(theme);
  }, [theme]);

  useEffect(() => {
    initSync();
    const onVisible = () => {
      if (document.visibilityState === "visible") void syncAll();
    };
    const onRemoteTheme = () => setTheme(loadTheme());
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("anime-calendar:theme-remote", onRemoteTheme);
    const iv = window.setInterval(() => void syncAll(), 30 * 60 * 1000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("anime-calendar:theme-remote", onRemoteTheme);
      window.clearInterval(iv);
    };
  }, []);

  // 站内/浏览器通知自动检查（铃铛已移除，保留静默提醒）：加载后、切回前台、每 30 分钟
  useEffect(() => {
    const check = () => {
      if (document.visibilityState === "visible") showTodayNotifications(follows);
    };
    const t = window.setTimeout(() => showTodayNotifications(follows), 2500);
    const onVis = () => check();
    document.addEventListener("visibilitychange", onVis);
    const iv = window.setInterval(() => showTodayNotifications(follows), 30 * 60 * 1000);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(iv);
    };
  }, [follows]);

  const runRefresh = useCallback(() => {
    setPage("home");
    setMode("skeleton");
    void refreshFromRemote().then((ok) => {
      setMode("normal");
      toast(ok ? "数据已更新" : "已使用本地数据（刷新源不可用）");
    });
  }, [toast]);

  const onWarnClose = useCallback(() => {
    try {
      localStorage.setItem(WARN_DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setWarn(false);
  }, []);

  // 页面切换：回到顶部，避免浏览器按新页面高度钳制滚动位置造成的跳动
  const navigate = useCallback((p: Page) => {
    setPage(p);
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  return (
    <>
      <a className="skip-link" href="#main">跳到主要内容</a>
      <Header
        page={page}
        followCount={count}
        theme={theme}
        onNavigate={navigate}
        onToggleTheme={() => {
          setTheme((t) => (t === "dark" ? "light" : "dark"));
          queueSettingsChange();
        }}
        onRefresh={runRefresh}
      />
      <main id="main" className="container page">
        {page === "home" ? (
          <HomeView
            platform={platform}
            onPlatformChange={setPlatform}
            mode={mode}
            onRetry={runRefresh}
            warn={warn}
            onWarnClose={onWarnClose}
            onNavigate={navigate}
          />
        ) : null}
        {page === "follow" ? <FollowView onNavigate={navigate} /> : null}
        {page === "calendar" ? <CalendarView onNavigate={navigate} /> : null}
      </main>
    </>
  );
}
