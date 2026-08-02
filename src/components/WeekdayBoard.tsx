import { useState } from "react";
import { addDays, sameDay, WEEK_CN } from "../lib/date";
import { ChevronDownIcon, ChevronUpIcon } from "../lib/icons";
import { itemsOn } from "../lib/items";
import { applyFilters, type ItemFilters } from "../lib/filters";
import { useBlocked } from "../store/blocked";
import { useFollows } from "../store/follows";
import { TODAY } from "../store/data";
import type { Mode, PlatformFilter } from "../types";
import { AnimeCard } from "./AnimeCard";
import { useToast } from "./Toast";

const MAX_VISIBLE = 12; // 两行 × 6 张卡；超出显示「+N 部」展开

export function WeekdayBoard({
  platform,
  mode,
  weekStart,
  filters,
}: {
  platform: PlatformFilter;
  mode: Mode;
  weekStart: Date;
  filters: ItemFilters;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const { isFollowed, toggle } = useFollows();
  const { isBlocked, toggle: toggleBlock } = useBlocked();
  const toast = useToast();

  const toggleDay = (wd: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(wd)) next.delete(wd);
      else next.add(wd);
      return next;
    });
  };

  const openItem = (url?: string, title?: string) => {
    if (url && url !== "#") {
      window.open(url, "_blank", "noopener");
    } else {
      toast(`「${title}」直达链接由数据管道解析后提供（示例数据）`);
    }
  };

  const rows = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const wd = i + 1;
    const items = mode === "empty" ? [] : applyFilters(itemsOn(date, platform), filters);
    const isToday = sameDay(date, TODAY);
    const isExpanded = expanded.has(wd);
    const visible = items.slice(0, isExpanded ? items.length : MAX_VISIBLE);
    const more = items.length - visible.length;
    const moreChip =
      more > 0 ? (
        <button className="day-more" aria-expanded="false" onClick={() => toggleDay(wd)}>
          <span>+{more} 部</span>
          <small>查看该日全部更新</small>
          <ChevronDownIcon />
        </button>
      ) : isExpanded ? (
        <button className="day-more expanded" aria-expanded="true" onClick={() => toggleDay(wd)}>
          收起 <ChevronUpIcon />
        </button>
      ) : null;

    return (
      <section key={wd} className={`day-row ${isToday ? "today" : ""}`} data-day={wd}>
        <div className="day-rail">
          <span className="dow">{WEEK_CN[i]}</span>
          <span className="date">{date.getMonth() + 1}月{date.getDate()}日</span>
          {isToday ? <span className="today-chip">今天</span> : null}
          {mode !== "skeleton" && items.length ? <span className="day-count">{items.length} 部</span> : null}
        </div>
        <div className="day-cards">
          {mode === "skeleton"
            ? Array.from({ length: 3 }, (_, k) => (
                <div key={k} className="sk-card">
                  <div className="sk-poster" />
                  <div className="sk-lines">
                    <div className="sk-line w90" />
                    <div className="sk-line w60" />
                  </div>
                </div>
              ))
            : visible.length
              ? visible.map((item) => (
                  <AnimeCard
                    key={item.id}
                    item={item}
                    followed={isFollowed(item.title)}
                    onToggleFollow={() => toggle(item)}
                    blocked={isBlocked(item.title)}
                    onToggleBlock={() => {
                      const wasBlocked = isBlocked(item.title);
                      toggleBlock(item.title);
                      toast(wasBlocked ? `已取消屏蔽《${item.title}》` : `已屏蔽《${item.title}》，短剧过滤开启即隐藏`);
                    }}
                    onClick={() => openItem(item.url, item.title)}
                  />
                )).concat(moreChip ? [moreChip] : [])
              : <div className="day-empty">暂无更新</div>}
        </div>
      </section>
    );
  });

  return <div className="board">{rows}</div>;
}
