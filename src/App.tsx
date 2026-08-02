import { useCallback, useEffect, useState } from "react";
import { Header } from "./components/Header";
import { useToast } from "./components/Toast";
import { loadTheme, saveTheme, type Theme } from "./store/theme";
import { useFollows } from "./store/follows";
import { refreshFromRemote } from "./store/data";
import { initSync, syncAll } from "./lib/sync";
import { queueSettingsChange } from "./lib/syncQueue";
import type { Mode, Page, PlatformFilter } from "./types";
import { CalendarView } from "./views/CalendarView";
import { FollowView } from "./views/FollowView";
import { HomeView } from "./views/HomeView";

function param(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}

export function App() {
  const toast = useToast();
  const { count } = useFollows();
  const [page, setPage] = useState<Page>(() => {
    const p = param("p");
    return p === "follow" || p === "calendar" ? p : "home";
  });
  const [platform, setPlatform] = useState<PlatformFilter>("all");
  const [mode, setMode] = useState<Mode>(() => {
    const s = param("state");
    return s === "skeleton" || s === "error" || s === "empty" ? s : "normal";
  });
  const [warn, setWarn] = useState<boolean>(() => param("warn") !== "0");
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

  const runRefresh = useCallback(() => {
    setPage("home");
    setMode("skeleton");
    void refreshFromRemote().then((ok) => {
      setMode("normal");
      setWarn(true);
      toast(ok ? "数据已更新" : "已使用本地数据（刷新源不可用）");
    });
  }, [toast]);

  return (
    <>
      <a className="skip-link" href="#main">跳到主要内容</a>
      <Header
        page={page}
        followCount={count}
        theme={theme}
        onNavigate={setPage}
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
            onWarnClose={() => setWarn(false)}
            onNavigate={setPage}
          />
        ) : null}
        {page === "follow" ? <FollowView onNavigate={setPage} /> : null}
        {page === "calendar" ? <CalendarView onNavigate={setPage} /> : null}
      </main>
    </>
  );
}
