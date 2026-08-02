import type { BadgeKey } from "../lib/filters";

const BADGES: BadgeKey[] = ["独播", "SVIP抢先", "限免", "超前点映", "结局点映", "大结局", "完结"];

export function FilterChips({
  badges,
  ongoingOnly,
  onChange,
}: {
  badges: ReadonlySet<BadgeKey>;
  ongoingOnly: boolean;
  onChange: (badges: Set<BadgeKey>, ongoingOnly: boolean) => void;
}) {
  const toggle = (b: BadgeKey) => {
    const next = new Set(badges);
    if (next.has(b)) next.delete(b);
    else next.add(b);
    onChange(next, ongoingOnly);
  };
  return (
    <div className="filter-chips" aria-label="筛选条件">
      {BADGES.map((b) => (
        <button key={b} className={`chip ${badges.has(b) ? "active" : ""}`} aria-pressed={badges.has(b)} onClick={() => toggle(b)}>
          {b}
        </button>
      ))}
      <button className={`chip ${ongoingOnly ? "active" : ""}`} aria-pressed={ongoingOnly} onClick={() => onChange(new Set(badges), !ongoingOnly)}>
        只看连载
      </button>
      {badges.size || ongoingOnly ? (
        <button className="chip" onClick={() => onChange(new Set(), false)}>
          清除筛选
        </button>
      ) : null}
    </div>
  );
}
