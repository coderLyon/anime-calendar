import type { KeyboardEvent } from "react";
import { WEEK_CN } from "../lib/date";
import { StarIcon } from "../lib/icons";
import { platShort } from "../lib/platforms";
import { posterGlyph, posterStyle } from "../lib/poster";
import type { AnimeItem } from "../types";

function Tag({ item }: { item: AnimeItem }) {
  if (item.svip) return <span className="tag svip">SVIP抢先</span>;
  if (item.badge === "独播") return <span className="tag dubo">独播</span>;
  if (item.badge === "限免") return <span className="tag mianfei">限免</span>;
  return null;
}

interface AnimeCardProps {
  item: AnimeItem;
  followed: boolean;
  onToggleFollow: () => void;
  onClick: () => void;
}

export function AnimeCard({ item, followed, onToggleFollow, onClick }: AnimeCardProps) {
  const onKey = (e: KeyboardEvent) => {
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
        {item.poster ? <img src={item.poster} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="ph-glyph">{posterGlyph(item.title)}</span>}
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
      </div>
      <div className="card-body">
        <h3 className="card-title">{item.title}</h3>
        <div className="card-meta">
          <span className={`plat-dot ${item.platform}`} />
          {item.episode} · {WEEK_CN[(item.weekday ?? 0) - 1] ?? ""}
          {item.updateTime ? ` ${item.updateTime}` : ""}
        </div>
        <div className="card-tags">
          <Tag item={item} />
        </div>
      </div>
    </article>
  );
}
