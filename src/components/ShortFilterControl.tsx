import { getShortFilter, setShortFilter, useShortFilterVersion } from "../lib/shortFilter";

const PRESETS = [
  { label: "1 分钟", sec: 60 },
  { label: "3 分钟", sec: 180 },
  { label: "5 分钟", sec: 300 },
  { label: "10 分钟", sec: 600 },
];

export function ShortFilterControl() {
  useShortFilterVersion();
  const { enabled, thresholdSec } = getShortFilter();
  const cur = PRESETS.find((p) => p.sec === thresholdSec) ?? { label: `${Math.round(thresholdSec / 60)} 分钟`, sec: thresholdSec };
  return (
    <div className="short-filter">
      <button
        className={`chip ${enabled ? "active" : ""}`}
        title={enabled ? "当前隐藏不足阈值的短剧，点击关闭过滤" : "点击开启短剧过滤"}
        onClick={() => setShortFilter({ enabled: !enabled, thresholdSec })}
      >
        短剧过滤 {enabled ? "开" : "关"}
      </button>
      {enabled ? (
        <select
          className="short-filter-select"
          value={cur.sec}
          aria-label="短剧时长阈值"
          onChange={(e) => setShortFilter({ enabled, thresholdSec: Number(e.target.value) })}
        >
          {PRESETS.map((p) => (
            <option key={p.sec} value={p.sec}>
              {p.label}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}
