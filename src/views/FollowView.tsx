import { useMemo, useRef, useState } from "react";
import { BellIcon, ChevronLeftIcon, DownloadIcon, ExternalIcon, UploadIcon } from "../lib/icons";
import { WEEK_CN } from "../lib/date";
import { PLATFORMS, platShort, PlatformLogo } from "../lib/platforms";
import { posterGlyph, posterStyle } from "../lib/poster";
import { platformInfoFor, posterForTitle } from "../lib/items";
import { missKey, missedWeek, type MissedEntry } from "../lib/missed";
import { readIgnoreMissed, writeIgnoreMissed } from "../lib/sync";
import { queueSettingsChange } from "../lib/syncQueue";
import { normTitle, useFollows } from "../store/follows";
import { ITEMS, useDataVersion } from "../store/data";
import { SearchBox } from "../components/SearchBox";
import { EmptyState } from "../components/EmptyState";
import { useToast } from "../components/Toast";
import type { FollowItem, Page, PlatformKey } from "../types";

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

  // 与看板搜索行为一致：规范化标题匹配（忽略标点/大小写）+ 同一 SearchBox 组件
  const list = Object.values(follows)
    .filter((f) => {
      const q = normTitle(query);
      const okQ = !q || normTitle(f.title).includes(q);
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
            <DownloadIcon /> <span className="btn-text">导出</span>
          </button>
          <button className="btn ghost" onClick={() => fileRef.current?.click()}>
            <UploadIcon /> <span className="btn-text">导入</span>
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
        <SearchBox value={query} onChange={setQuery} />
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

interface EnrichedPlatform {
  platform: PlatformKey;
  episode: string;
  updateTime: string;
  url?: string;
  rule?: string;
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
  const notifyOn = follow.notify ?? true;
  const poster = posterForTitle(follow.title);

  // 用当前周数据补全展示（历史收藏可能缺腾讯更新时间、链接过期）
  const enriched: EnrichedPlatform[] = follow.platforms.map((p) => {
    const info = platformInfoFor(follow.title, p.platform);
    return {
      platform: p.platform,
      episode: info?.episode ?? p.episode,
      updateTime: info?.updateTime ?? p.updateTime ?? "",
      url: info?.url ?? p.url,
      rule: info?.rule,
    };
  });
  const sorted = [...enriched].sort((a, b) => a.platform.localeCompare(b.platform));
  const main = [...sorted].sort((a, b) => b.updateTime.localeCompare(a.updateTime))[0] ?? sorted[0];
  const others = sorted.filter((p) => p !== main);

  const openUrl = (p: EnrichedPlatform): string | undefined => (p.url && p.url !== "#" ? p.url : undefined);

  return (
    <div className="follow-item">
      <div className="fi-row">
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
        <div className="fi-main">
          <div className="cal-item-title-row fi-title-row">
            <span className={`plat-chip ${main.platform}`}>{platShort(main.platform)}</span>
            <span className="fi-title-text">{follow.title}</span>
            {sorted.length > 1 ? <span className="tag dubo">{sorted.length} 平台</span> : null}
          </div>
          <div className="cal-item-meta fi-meta">
            <span className={`plat-dot ${main.platform}`} />
            {main.episode}
            {main.updateTime ? ` · ${main.updateTime}` : ""}
            {missed.length ? ` · 疑似断更${missed.length > 1 ? ` ${missed.length} 次` : ` ${WEEK_CN[missed[0].weekday - 1]}`}` : ""}
          </div>
          {main.rule ? <div className="cal-item-rule fi-rule">官方更新：{main.rule}</div> : null}
          {missed.length ? (
            <div className="missed-row">
              <button className="btn ghost sm" onClick={() => onIgnoreMissed(missed[0].key, missed[0].date)}>
                忽略断更提示
              </button>
            </div>
          ) : null}
        </div>
        <div className="fi-side">
          <span className="cal-item-time">{main.updateTime || "更新"}</span>
          <a
            className="cal-item-open"
            href={openUrl(main)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              if (!openUrl(main)) e.preventDefault();
            }}
          >
            <ExternalIcon /> 最新集
          </a>
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
      {others.length ? (
        <div className="fi-links">
          {others.map((p) => (
            <a
              key={p.platform}
              className="fi-link"
              href={openUrl(p)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (!openUrl(p)) e.preventDefault();
              }}
            >
              <span className={`plat-dot ${p.platform}`} />
              <span className="fi-link-meta">{p.episode}{p.updateTime ? ` · ${p.updateTime}` : ""}</span>
              <span className="fi-link-go">最新集 <ExternalIcon /></span>
            </a>
          ))}
        </div>
      ) : null}
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
