import type { KeyboardEvent } from "react";
import { WEEK_CN } from "../lib/date";
import { BanIcon, StarIcon } from "../lib/icons";
import { badgeHas } from "../lib/filters";
import { formatDuration } from "../lib/items";
import { platShort } from "../lib/platforms";
import { posterGlyph, posterStyle } from "../lib/poster";
import type { AnimeItem } from "../types";

function Tag({ item }: { item: AnimeItem }) {
  if (item.svip) return <span className="tag svip">SVIP抢先</span>;
  if (badgeHas(item, "独播")) return <span className="tag dubo">独播</span>;
  if (badgeHas(item, "限免")) return <span className="tag mianfei">限免</span>;
  if (badgeHas(item, "超前点映")) return <span className="tag cqdy">超前点映</span>;
  if (badgeHas(item, "结局点映")) return <span className="tag jujie">结局点映</span>;
  if (badgeHas(item, "大结局")) return <span className="tag wanjie">大结局</span>;
  if (item.finished) return <span className="tag wanjie">完结</span>;
  return null;
}

interface AnimeCardProps {
  item: AnimeItem;
  followed: boolean;
  onToggleFollow: () => void;
  blocked: boolean;
  onToggleBlock: () => void;
  onClick: () => void;
}

export function AnimeCard({ item, followed, onToggleFollow, blocked, onToggleBlock, onClick }: AnimeCardProps) {
  const dur = formatDuration(item.duration);
  const onKey = (e: KeyboardEvent) => {
    // 星标/屏蔽按钮自身处理键盘事件，避免冒泡到整卡连带打开剧集链接
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };
  return (
    <article
      className={`card ${followed ? "followed" : ""}`}
      role="button"
      tabIndex={0}
      aria-label={`${item.title} ${item.episode}`}
      onClick={onClick}
      onKeyDown={onKey}
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
            onToggleFollow();
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
            onToggleBlock();
          }}
        >
          <BanIcon />
        </button>
      </div>
      <div className="card-body">
        <h3 className="card-title">{item.title}</h3>
        <div className="card-meta">
          <span className={`plat-dot ${item.platform}`} />
          {item.episode} · {WEEK_CN[(item.weekday ?? 0) - 1] ?? ""}
          {item.updateTime ? ` ${item.updateTime}` : ""}
          {dur ? ` · ${dur}` : ""}
        </div>
        <div className="card-tags">
          <Tag item={item} />
        </div>
      </div>
    </article>
  );
}
