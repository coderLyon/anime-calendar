import { getShortFilter, setShortFilter, useShortFilterVersion } from "../lib/shortFilter";
import { queueSettingsChange } from "../lib/syncQueue";
import { normKey, useBlocked } from "../store/blocked";
import { ITEMS } from "../store/data";

const PRESETS = [
  { label: "1 分钟", sec: 60 },
  { label: "3 分钟", sec: 180 },
  { label: "5 分钟", sec: 300 },
  { label: "10 分钟", sec: 600 },
  { label: "15 分钟", sec: 900 },
];

export function ShortFilterControl() {
  useShortFilterVersion();
  const { blocked } = useBlocked();
  const { enabled, thresholdSec } = getShortFilter();
  // 只统计「当前数据中确实会被屏蔽隐藏」的剧集数，避免把历史/已下架屏蔽项算进去
  const blockedInData = new Set<string>();
  for (const it of ITEMS) {
    if (blocked[normKey(it.title)]) blockedInData.add(normKey(it.title));
  }
  const cur = PRESETS.find((p) => p.sec === thresholdSec) ?? { label: `${Math.round(thresholdSec / 60)} 分钟`, sec: thresholdSec };
  const change = (next: { enabled?: boolean; thresholdSec?: number }) => {
    setShortFilter({ enabled: next.enabled ?? enabled, thresholdSec: next.thresholdSec ?? thresholdSec });
    queueSettingsChange();
  };

  return (
    <div className="short-filter">
      <button
        className={`chip ${enabled ? "active" : ""}`}
        title={enabled ? "当前隐藏不足阈值的短剧，点击关闭过滤" : "点击开启短剧过滤"}
        onClick={() => change({ enabled: !enabled })}
      >
        短剧过滤 {enabled ? "开" : "关"}
      </button>
      {enabled ? (
        <>
          <select
            className="short-filter-select"
            value={cur.sec}
            aria-label="短剧时长阈值"
            onChange={(e) => change({ thresholdSec: Number(e.target.value) })}
          >
            {PRESETS.map((p) => (
              <option key={p.sec} value={p.sec}>
                {p.label}
              </option>
            ))}
          </select>
          {blockedInData.size > 0 ? <span className="filter-hint">已屏蔽 {blockedInData.size} 部（当前数据，过滤开启即隐藏）</span> : null}
        </>
      ) : null}
    </div>
  );
}
