import { useRef } from "react";
import { addDays, sameDay, WEEK_CN } from "../lib/date";
import { BanIcon, StarIcon } from "../lib/icons";
import { itemsOn } from "../lib/items";
import { platShort } from "../lib/platforms";
import { posterGlyph, posterStyle } from "../lib/poster";
import { useBlocked } from "../store/blocked";
import { useFollows } from "../store/follows";
import { TODAY, WEEK_START } from "../store/data";
import type { Mode, PlatformFilter } from "../types";
import { useToast } from "./Toast";

interface MobileBoardProps {
  platform: PlatformFilter;
  mode: Mode;
  day: number;
  onDayChange: (d: number) => void;
}

export function MobileBoard({ platform, mode, day, onDayChange }: MobileBoardProps) {
  const { isFollowed, toggle } = useFollows();
  const { isBlocked, toggle: toggleBlock } = useBlocked();
  const toast = useToast();
  const touchX = useRef<number | null>(null);

  const date = addDays(WEEK_START, day - 1);
  const items = mode === "empty" ? [] : itemsOn(date, platform);

  const onTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) < 48) return;
    const dir = dx > 0 ? -1 : 1;
    onDayChange(Math.min(7, Math.max(1, day + dir)));
  };

  return (
    <div className="m-board" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="m-tabs">
        {Array.from({ length: 7 }, (_, i) => {
          const d = addDays(WEEK_START, i);
          const wd = i + 1;
          const isToday = sameDay(d, TODAY);
          const count = itemsOn(d, platform).length;
          return (
            <button key={wd} data-mday={wd} className={`m-tab ${day === wd ? "active" : ""}`} onClick={() => onDayChange(wd)}>
              <span className="dow">
                {WEEK_CN[i]}
                {isToday ? <span className="today-dot" /> : null}
              </span>
              <span className="date">{d.getMonth() + 1}月{d.getDate()}日</span>
              <span className="date">{count} 部</span>
            </button>
          );
        })}
      </div>
      <div className="m-list">
        {mode === "skeleton"
          ? Array.from({ length: 4 }, (_, k) => (
              <div key={k} className="m-card sk-card">
                <div className="sk-poster" />
                <div className="sk-lines">
                  <div className="sk-line w90" />
                  <div className="sk-line w60" />
                  <div className="sk-line w90" />
                </div>
              </div>
            ))
          : items.length
            ? items.map((item) => {
                const followed = isFollowed(item.title);
                const blocked = isBlocked(item.title);
                return (
                  <article
                    key={item.id}
                    className={`m-card ${followed ? "followed" : ""}`}
                    onClick={() => {
                      if (item.url && item.url !== "#") window.open(item.url, "_blank", "noopener");
                      else toast(`「${item.title}」直达链接由数据管道解析后提供（示例数据）`);
                    }}
                  >
                    <div className="poster" style={{ background: posterStyle(item.title) }}>
                      <span className="ph-mark" />
                      {item.poster ? (
                        <img
                          src={item.poster}
                          alt=""
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={(e) => { e.currentTarget.style.display = "none"; }}
                        />
                      ) : (
                        <span className="ph-glyph">{posterGlyph(item.title)}</span>
                      )}
                      <span className={`plat-chip ${item.platform}`}>{platShort(item.platform)}</span>
                      <button
                        className={`star-btn ${followed ? "on" : ""}`}
                        aria-label={followed ? "取消追番" : "加入追番"}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggle(item);
                        }}
                      >
                        <StarIcon />
                      </button>
                      <button
                        className={`block-btn ${blocked ? "on" : ""}`}
                        aria-label={blocked ? "取消屏蔽" : "屏蔽"}
                        title={blocked ? "取消屏蔽" : "屏蔽该剧集"}
                        onClick={(e) => {
                          e.stopPropagation();
                          const wasBlocked = isBlocked(item.title);
                          toggleBlock(item.title);
                          toast(wasBlocked ? `已取消屏蔽《${item.title}》` : `已屏蔽《${item.title}》，短剧过滤开启即隐藏`);
                        }}
                      >
                        <BanIcon />
                      </button>
                    </div>
                    <div className="m-info">
                      <h3 className="m-title">{item.title}</h3>
                      <div className="m-meta">
                        <span className={`plat-dot ${item.platform}`} />
                        {item.episode}
                      </div>
                      <div className="m-time">{WEEK_CN[(item.weekday ?? 0) - 1] ?? ""}{item.updateTime ? ` ${item.updateTime}` : ""} 更新</div>
                      <div className="m-tags">
                        {item.svip ? <span className="tag svip">SVIP抢先</span> : null}
                        {item.badge === "独播" ? <span className="tag dubo">独播</span> : null}
                        {item.badge === "限免" ? <span className="tag mianfei">限免</span> : null}
                        {item.badge === "超前点映" ? <span className="tag cqdy">超前点映</span> : null}
                        {item.badge === "结局点映" ? <span className="tag jujie">结局点映</span> : null}
                        {item.badge === "大结局" ? <span className="tag wanjie">大结局</span> : null}
                        {item.finished ? <span className="tag wanjie">完结</span> : null}
                      </div>
                    </div>
                  </article>
                );
              })
            : (
              <div className="empty">
                <div className="empty-icon"><StarIcon /></div>
                <h3>{WEEK_CN[day - 1]}暂无更新</h3>
                <p>{WEEK_CN[day - 1]}还没有剧集更新，去看看其他平台吧</p>
              </div>
            )}
      </div>
    </div>
  );
}
