import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "../lib/icons";

/** 多周导航：历史 8 周（懒加载）+ 本周 + 下周预计（迭代计划书 M5） */
export function WeekNav({
  offset,
  min,
  max,
  onChange,
}: {
  offset: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="week-nav">
      {offset !== 0 ? (
        <>
          <span className={`tag ${offset > 0 ? "predicted" : ""}`}>{offset > 0 ? "预计" : "历史"}</span>
          <button className="btn ghost sm" aria-label="回到本周" onClick={() => onChange(0)}>
            <CalendarIcon /> <span className="btn-text">回到本周</span>
          </button>
        </>
      ) : (
        <span className="tag">本周</span>
      )}
      <button className="nav-btn" aria-label="上一周" disabled={offset <= min} onClick={() => onChange(offset - 1)}>
        <ChevronLeftIcon />
      </button>
      <button className="nav-btn" aria-label="下一周" disabled={offset >= max} onClick={() => onChange(offset + 1)}>
        <ChevronRightIcon />
      </button>
    </div>
  );
}
