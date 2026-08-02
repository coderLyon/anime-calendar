import { getShortFilter, setShortFilter, useShortFilterVersion } from "../lib/shortFilter";
import { hiddenStats } from "../lib/shortFilter";
import { queueSettingsChange } from "../lib/syncQueue";
import { useBlocked } from "../store/blocked";
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
  // 统计与 applyShortFilter 完全一致：当前周真实条目中被过滤隐藏的剧部数
  // （时长不足 + 手动屏蔽 + 优酷断句标点；排除 predicted 与历史周条目）
  const stats = hiddenStats(ITEMS, thresholdSec, new Set(Object.keys(blocked)));
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
          {stats.hidden > 0 ? (
            <span className="filter-hint">
              已过滤 {stats.hidden} 部{stats.manual > 0 ? ` · 手动屏蔽 ${stats.manual} 部` : ""}（当前数据，开启即隐藏）
            </span>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
