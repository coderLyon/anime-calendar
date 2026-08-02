export type Theme = "light" | "dark";

const THEME_KEY = "anime-calendar.theme.v1";

export function loadTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === "light" || t === "dark") return t;
  } catch {
    /* ignore */
  }
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function saveTheme(t: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {
    /* ignore */
  }
}

/** 远端设置合并回本地主题：写存储并广播事件，App 监听后同步 React 状态 */
export function applyRemoteTheme(t: Theme | null): void {
  if (t === "light" || t === "dark") saveTheme(t);
  try {
    window.dispatchEvent(new Event("anime-calendar:theme-remote"));
  } catch {
    /* ignore */
  }
}
