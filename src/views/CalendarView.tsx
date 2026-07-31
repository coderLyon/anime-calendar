import { useEffect, useRef, useState } from "react";
import { EmptyState } from "../components/EmptyState";
import { Segmented } from "../components/Segmented";
import { useToast } from "../components/Toast";
import { SAMPLE_TODAY } from "../data/items";
import { addDays, isoWeek, sameDay, wdOf, WEEK_CN } from "../lib/date";
import { ChevronLeftIcon, ChevronRightIcon } from "../lib/icons";
import { itemsOn } from "../lib/items";
import { platShort } from "../lib/platforms";
import { posterGlyph, posterStyle } from "../lib/poster";
import { normTitle, useFollows } from "../store/follows";
import type { AnimeItem, CalScope, CalView } from "../types";

function openItem(item: AnimeItem, toast: (m: string) => void) {
  if (item.url && item.url !== "#") {
    window.open(item.url, "_blank", "noopener");
  } else {
    toast(`「${item.title}」直达链接由数据管道解析后提供（示例数据）`);
  }
}

function CalItem({ item, toast }: { item: AnimeItem; toast: (m: string) => void }) {
  return (
    <div className="cal-item" onClick={() => openItem(item, toast)}>
      <div className="poster" style={{ background: posterStyle(item.title) }}>
        <span className="ph-mark" />
        {item.poster ? <img src={item.poster} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="ph-glyph">{posterGlyph(item.title)}</span>}
        <span className={`plat-chip ${item.platform}`}>{platShort(item.platform)}</span>
      </div>
      <div className="cal-item-main">
        <div className="cal-item-title">{item.title}</div>
        <div className="cal-item-meta">
          <span className={`plat-dot ${item.platform}`} />
          {item.episode}
          {item.svip ? " · SVIP抢先" : ""}
          {item.badge === "独播" ? " · 独播" : ""}
        </div>
      </div>
      <span className="cal-item-time">{item.updateTime}</span>
    </div>
  );
}

export function CalendarView() {
  const { follows } = useFollows();
  const toast = useToast();
  const [view, setView] = useState<CalView>(() => {
    const v = new URLSearchParams(location.search).get("view");
    return v === "week" || v === "month" ? v : "schedule";
  });
  const [scope, setScope] = useState<CalScope>("follow");
  const [calDate, setCalDate] = useState<Date>(() => new Date(SAMPLE_TODAY));
  const [calMonth, setCalMonth] = useState<Date>(() => new Date(SAMPLE_TODAY.getFullYear(), SAMPLE_TODAY.getMonth(), 1));
  const [weekSel, setWeekSel] = useState<number>(() => wdOf(SAMPLE_TODAY));
  const [monthSel, setMonthSel] = useState<number>(() => SAMPLE_TODAY.getDate());
  const touchX = useRef<number | null>(null);

  const scopeItems = (d: Date) => itemsOn(d, "all").filter((i) => scope === "all" || follows[normTitle(i.title)]);

  const backToday = () => {
    setCalDate(new Date(SAMPLE_TODAY));
    setCalMonth(new Date(SAMPLE_TODAY.getFullYear(), SAMPLE_TODAY.getMonth(), 1));
    setWeekSel(wdOf(SAMPLE_TODAY));
    setMonthSel(SAMPLE_TODAY.getDate());
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast("已回到今天");
  };

  const step = (dir: number) => {
    if (view === "month") setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() + dir, 1));
    else if (view === "week") setCalDate((d) => addDays(d, dir * 7));
    else setCalDate((d) => addDays(d, dir));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const onTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) < 48) return;
    step(dx > 0 ? -1 : 1);
  };

  const sub =
    view === "schedule" ? "当日更新列表 + 明日预告" : view === "week" ? "7 列周网格，今日高亮定位" : "月历 + 每日更新数角标";

  return (
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="page-head">
        <div>
          <h1>追番日历</h1>
          <div className="sub">{sub} · 范围默认为「仅已追番」，可切换「全部番剧」</div>
        </div>
      </div>
      <div className="cal-head">
        <div className="cal-controls">
          <Segmented value={scope} options={[{ value: "follow", label: "仅已追番" }, { value: "all", label: "全部番剧" }]} onChange={setScope} />
          <Segmented value={view} options={[{ value: "schedule", label: "日程" }, { value: "week", label: "周视图" }, { value: "month", label: "月视图" }]} onChange={setView} />
        </div>
        <div className="cal-nav">
          <button className="nav-btn" aria-label="上一页" onClick={() => step(-1)}>
            <ChevronLeftIcon />
          </button>
          <div className={`cal-date-title ${sameDay(calDate, SAMPLE_TODAY) ? "today" : ""}`}>
            {view === "month" ? (
              <>
                <div className="d">{calMonth.getFullYear()}年{calMonth.getMonth() + 1}月</div>
                <div className="week">本月 {monthTotal(calMonth, scopeItems)} 部更新</div>
              </>
            ) : view === "week" ? (
              <>
                <div className="d">
                  {mondayOf(calDate).getMonth() + 1}月{mondayOf(calDate).getDate()}日 – {addDays(mondayOf(calDate), 6).getMonth() + 1}月{addDays(mondayOf(calDate), 6).getDate()}日
                </div>
                <div className="week">第 {isoWeek(mondayOf(calDate))} 周</div>
              </>
            ) : (
              <>
                <div className="d">
                  {calDate.getMonth() + 1}月{calDate.getDate()}日{sameDay(calDate, SAMPLE_TODAY) ? " · 今天" : ""}
                </div>
                <div className="week">{WEEK_CN[wdOf(calDate) - 1]} · {scopeItems(calDate).length} 部更新</div>
              </>
            )}
          </div>
          <button className="nav-btn" aria-label="下一页" onClick={() => step(1)}>
            <ChevronRightIcon />
          </button>
          <button className="btn ghost sm" onClick={backToday}>回到今天</button>
        </div>
      </div>

      {view === "schedule" ? renderSchedule(calDate, scopeItems, toast) : null}
      {view === "week" ? renderWeek(calDate, weekSel, setWeekSel, scopeItems, toast) : null}
      {view === "month" ? renderMonth(calMonth, monthSel, setMonthSel, scopeItems, toast) : null}
    </div>
  );
}

function mondayOf(d: Date): Date {
  return addDays(d, 1 - wdOf(d));
}

function monthTotal(m: Date, scopeItems: (d: Date) => AnimeItem[]): number {
  const days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
  let total = 0;
  for (let day = 1; day <= days; day++) total += scopeItems(new Date(m.getFullYear(), m.getMonth(), day)).length;
  return total;
}

function renderSchedule(calDate: Date, scopeItems: (d: Date) => AnimeItem[], toast: (m: string) => void) {
  const items = scopeItems(calDate);
  const tomorrow = addDays(calDate, 1);
  const tItems = scopeItems(tomorrow).slice(0, 5);
  return (
    <div className="cal-layout">
      <div className="cal-panel">
        <h3>
          {WEEK_CN[wdOf(calDate) - 1]}更新 <span className="hint">点击条目直达最新正剧集</span>
        </h3>
        {items.length ? items.map((it) => <CalItem key={it.id} item={it} toast={toast} />) : (
          <EmptyState title={`${calDate.getMonth() + 1}月${calDate.getDate()}日无更新`} desc="这一天暂时没有追番更新，看看明日预告吧" />
        )}
      </div>
      <div className="cal-panel">
        <h3>
          明日预告{" "}
          <span className="hint">
            {tomorrow.getMonth() + 1}月{tomorrow.getDate()}日 {WEEK_CN[wdOf(tomorrow) - 1]} · {tItems.length} 部
          </span>
        </h3>
        {tItems.length ? (
          tItems.map((it) => (
            <div key={it.id} className="preview-item" onClick={() => openItem(it, toast)}>
              <div className="poster" style={{ background: posterStyle(it.title) }}>
                <span className="ph-mark" />
                <span className="ph-glyph">{posterGlyph(it.title)}</span>
              </div>
              <div className="preview-item-main">
                <div className="preview-item-title">{it.title}</div>
                <div className="preview-item-meta">
                  <span className={`plat-dot ${it.platform}`} />
                  {it.episode} · {it.updateTime}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div style={{ fontSize: 12.5, color: "var(--ink-3)", padding: "12px 4px" }}>明日暂无更新</div>
        )}
      </div>
    </div>
  );
}

function renderWeek(
  calDate: Date,
  weekSel: number,
  setWeekSel: (n: number) => void,
  scopeItems: (d: Date) => AnimeItem[],
  toast: (m: string) => void,
) {
  const monday = mondayOf(calDate);
  const cols = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const items = scopeItems(date);
    const isToday = sameDay(date, SAMPLE_TODAY);
    const sel = weekSel === i + 1;
    return (
      <div key={i} className={`week-col ${isToday ? "today" : ""} ${sel ? "sel" : ""}`} onClick={() => setWeekSel(i + 1)}>
        <div className="week-col-head">
          <span className="dow">{WEEK_CN[i]}{isToday ? " · 今天" : ""}</span>
          <span className="date">{date.getMonth() + 1}/{date.getDate()}</span>
        </div>
        <div className="week-items">
          {items.slice(0, 4).map((it) => (
            <div key={it.id} className="week-item" onClick={(e) => { e.stopPropagation(); openItem(it, toast); }}>
              <div className="poster" style={{ background: posterStyle(it.title) }}>
                <span className="ph-mark" />
                <span className="ph-glyph">{posterGlyph(it.title)}</span>
              </div>
              <div className="week-item-main">
                <div className="week-item-title">{it.title}</div>
                <div className="week-item-time">{it.episode} · {it.updateTime}</div>
              </div>
            </div>
          ))}
          {items.length > 4 ? <div style={{ fontSize: 11, color: "var(--ink-3)", padding: "2px 4px" }}>+{items.length - 4} 部</div> : null}
        </div>
      </div>
    );
  });

  const selDate = addDays(monday, weekSel - 1);
  const selItems = scopeItems(selDate);

  return (
    <>
      <div className="cal-layout">
        <div className="cal-panel" style={{ gridColumn: "1 / -1" }}>
          <h3>
            本周更新 <span className="hint">点击任意一天查看当日列表 · 今日列高亮</span>
          </h3>
          <div className="week-grid">{cols}</div>
          <div className="cal-mobile-week">
            <div className="m-tabs">
              {Array.from({ length: 7 }, (_, i) => {
                const date = addDays(monday, i);
                const isToday = sameDay(date, SAMPLE_TODAY);
                return (
                  <button key={i} className={`m-tab ${weekSel === i + 1 ? "active" : ""}`} onClick={() => setWeekSel(i + 1)}>
                    <span className="dow">
                      {WEEK_CN[i]}
                      {isToday ? <span className="today-dot" /> : null}
                    </span>
                    <span className="date">{date.getMonth() + 1}月{date.getDate()}日</span>
                    <span className="date">{scopeItems(date).length} 部</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <div className="cal-panel" style={{ marginTop: "var(--s4)" }}>
        <h3>
          {WEEK_CN[weekSel - 1]} · {selDate.getMonth() + 1}月{selDate.getDate()}日 详情 <span className="hint">{selItems.length} 部</span>
        </h3>
        {selItems.length ? selItems.map((it) => <CalItem key={it.id} item={it} toast={toast} />) : (
          <EmptyState title="当日无更新" desc="换一天看看" />
        )}
      </div>
    </>
  );
}

function renderMonth(
  calMonth: Date,
  monthSel: number,
  setMonthSel: (n: number) => void,
  scopeItems: (d: Date) => AnimeItem[],
  toast: (m: string) => void,
) {
  const first = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0).getDate();
  const cells: React.ReactNode[] = [];
  for (let i = 0; i < lead; i++) cells.push(<div key={`lead-${i}`} className="month-cell other" />);
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(calMonth.getFullYear(), calMonth.getMonth(), day);
    const items = scopeItems(date);
    const isToday = sameDay(date, SAMPLE_TODAY);
    const sel = monthSel === day;
    cells.push(
      <div key={day} className={`month-cell ${isToday ? "today" : ""} ${sel ? "sel" : ""}`} onClick={() => setMonthSel(day)}>
        <span className="d">{day}</span>
        {items.length ? <span className="cnt">{items.length}</span> : null}
        {items.length ? <div className="preview">{items.slice(0, 2).map((i) => i.title).join(" · ")}</div> : null}
      </div>,
    );
  }
  const trail = (7 - (cells.length % 7)) % 7;
  for (let i = 0; i < trail; i++) cells.push(<div key={`trail-${i}`} className="month-cell other" />);

  const selDate = new Date(calMonth.getFullYear(), calMonth.getMonth(), monthSel);
  const selItems = scopeItems(selDate);

  return (
    <>
      <div className="cal-layout">
        <div className="cal-panel" style={{ gridColumn: "1 / -1" }}>
          <h3>
            {calMonth.getMonth() + 1}月更新日历 <span className="hint">角标 = 当日更新数 · 点击日期查看详情</span>
          </h3>
          <div className="month-grid">
            {WEEK_CN.map((w, i) => (
              <div key={i} className="month-dow">{w}</div>
            ))}
            {cells}
          </div>
        </div>
      </div>
      <div className="cal-panel" style={{ marginTop: "var(--s4)" }}>
        <h3>
          {selDate.getMonth() + 1}月{selDate.getDate()}日 · {WEEK_CN[wdOf(selDate) - 1]} 详情 <span className="hint">{selItems.length} 部</span>
        </h3>
        {selItems.length ? selItems.map((it) => <CalItem key={it.id} item={it} toast={toast} />) : (
          <EmptyState title="当日无更新" desc="换一天看看" />
        )}
      </div>
    </>
  );
}
