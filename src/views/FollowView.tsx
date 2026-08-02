import { useMemo, useRef, useState } from "react";
import { BellIcon, ChevronLeftIcon, DownloadIcon, ExternalIcon, SearchIcon, UploadIcon } from "../lib/icons";
import { WEEK_CN } from "../lib/date";
import { PLATFORMS, platShort, PlatformLogo } from "../lib/platforms";
import { posterGlyph, posterStyle } from "../lib/poster";
import { posterForTitle } from "../lib/items";
import { missKey, missedWeek, type MissedEntry } from "../lib/missed";
import { readIgnoreMissed, writeIgnoreMissed } from "../lib/sync";
import { queueSettingsChange } from "../lib/syncQueue";
import { useFollows } from "../store/follows";
import { ITEMS, useDataVersion } from "../store/data";
import type { FollowItem, Page, PlatformKey } from "../types";
import { EmptyState } from "../components/EmptyState";
import { useToast } from "../components/Toast";

type Filter = PlatformKey | "all";

export function FollowView({ onNavigate }: { onNavigate: (p: Page) => void }) {
  useDataVersion();
  const { follows, count, remove, exportJson, importJson } = useFollows();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [ignoreVer, setIgnoreVer] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const ignore = useMemo(() => new Set(readIgnoreMissed()), [ignoreVer, follows]);
  const missedByKey = useMemo(() => {
    const map = new Map<string, MissedEntry[]>();
    for (const m of missedWeek(follows, ITEMS, ignore)) {
      const list = map.get(m.key) ?? [];
      list.push(m);
      map.set(m.key, list);
    }
    return map;
  }, [follows, ITEMS, ignore]);

  const onIgnoreMissed = (key: string, date: string) => {
    const next = new Set(readIgnoreMissed());
    next.add(missKey(key, date));
    writeIgnoreMissed([...next]);
    queueSettingsChange();
    setIgnoreVer((v) => v + 1);
  };

  const list = Object.values(follows)
    .filter((f) => {
      const okQ = !query || f.title.toLowerCase().includes(query.toLowerCase());
      const okP = filter === "all" || f.platforms.some((p) => p.platform === filter);
      return okQ && okP;
    })
    .sort((a, b) => (a.followedAt || "").localeCompare(b.followedAt || ""));

  const onExport = () => {
    const blob = new Blob([exportJson()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `anime-calendar-follows-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("已导出追番 JSON");
  };

  const onImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const added = importJson(String(reader.result));
        toast(`导入成功：${added} 部新追番`);
      } catch {
        toast("导入失败：JSON 格式不正确");
      }
    };
    reader.readAsText(file);
  };

  const chips: Filter[] = ["all", ...PLATFORMS.map((p) => p.key)];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>追番列表</h1>
          <div className="sub">共 {count} 部 · 仅保存在本机（localStorage），支持导出/导入 JSON 备份</div>
        </div>
        <div className="page-actions">
          <button className="btn ghost" onClick={() => onNavigate("home")}>
            <ChevronLeftIcon /> 返回看板
          </button>
          <button className="btn ghost" onClick={onExport}>
            <DownloadIcon /> 导出
          </button>
          <button className="btn ghost" onClick={() => fileRef.current?.click()}>
            <UploadIcon /> 导入
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImport(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>
      <div className="toolbar">
        <div className="search-box">
          <SearchIcon />
          <input placeholder="搜索追番标题…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="tab-row">
          {chips.map((c) => (
            <button key={c} className={`chip ${filter === c ? "active" : ""}`} onClick={() => setFilter(c)}>
              {c === "all" ? null : <PlatformLogo platform={c} />}
              {c === "all" ? "全部" : platShort(c)}
            </button>
          ))}
        </div>
      </div>
      <div className="follow-list">
        {list.length
          ? list.map((f) => (
              <FollowItemRow
                key={f.key}
                follow={f}
                missed={missedByKey.get(f.key) ?? []}
                onRemove={() => { remove(f.key); toast("已取消追番"); }}
                onIgnoreMissed={onIgnoreMissed}
              />
            ))
          : (
              <EmptyState title="没有匹配的追番" desc="试试其他关键词或平台筛选；点星标即可把想追的番收进来">
                <button className="btn primary" onClick={() => onNavigate("home")}>
                  去首页看看
                </button>
              </EmptyState>
            )}
      </div>
    </>
  );
}

function FollowItemRow({
  follow,
  missed,
  onRemove,
  onIgnoreMissed,
}: {
  follow: FollowItem;
  missed: MissedEntry[];
  onRemove: () => void;
  onIgnoreMissed: (key: string, date: string) => void;
}) {
  const { setNotify } = useFollows();
  const poster = posterForTitle(follow.title);
  const sorted = [...follow.platforms].sort((a, b) => a.platform.localeCompare(b.platform));
  const notifyOn = follow.notify ?? true;
  return (
    <div className="follow-item">
      <div className="fi-head">
        <div className="poster" style={{ background: posterStyle(follow.title) }}>
          <span className="ph-mark" />
          {poster ? (
            <img
              src={poster}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          ) : (
            <span className="ph-glyph">{posterGlyph(follow.title)}</span>
          )}
        </div>
        <div className="fi-info">
          <div className="fi-title-row">
            {sorted.map((p) => (
              <span key={p.platform} className={`plat-chip ${p.platform}`}>{platShort(p.platform)}</span>
            ))}
            {follow.title}
            {follow.platforms.length > 1 ? <span className="tag dubo">{follow.platforms.length} 平台</span> : null}
          </div>
          <div className="fi-sub">
            共 {follow.platforms.length} 个平台 · 加入于 {follow.followedAt || "-"}
          </div>
          {missed.length ? (
            <div className="missed-row">
              <span className="tag missed">
                疑似断更 {missed.length > 1 ? `${missed.length} 次` : WEEK_CN[missed[0].weekday - 1]}
              </span>
              <button className="btn ghost sm" onClick={() => onIgnoreMissed(missed[0].key, missed[0].date)}>
                忽略
              </button>
            </div>
          ) : null}
        </div>
        <div className="fi-actions">
          <button
            className={`notify-btn ${notifyOn ? "on" : ""}`}
            aria-label={notifyOn ? "关闭更新提醒" : "开启更新提醒"}
            title={notifyOn ? "更新提醒已开启，点击关闭" : "更新提醒已关闭，点击开启"}
            onClick={() => setNotify(follow.key, !notifyOn)}
          >
            <BellIcon />
          </button>
          <button className="star-btn on" aria-label="取消追番" onClick={onRemove}>
            <StarFill />
          </button>
        </div>
      </div>
      <div className="fi-links">
        {sorted.map((p) => (
          <a
            key={p.platform}
            className="fi-link"
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              if (p.url === "#") e.preventDefault();
            }}
          >
            <span className={`plat-dot ${p.platform}`} />
            <span className="fi-link-meta">{p.episode}{p.updateTime ? ` · ${p.updateTime}` : ""}</span>
            <span className="fi-link-go">最新集 <ExternalIcon /></span>
          </a>
        ))}
      </div>
    </div>
  );
}

function StarFill() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="m12 3.2 2.7 5.6 6.1.8-4.5 4.3 1.1 6-5.4-2.9-5.4 2.9 1.1-6L3.2 9.6l6.1-.8Z" />
    </svg>
  );
}
