import { ChevronRightIcon } from "../lib/icons";
import { itemsOn } from "../lib/items";
import { applyFilters, type ItemFilters } from "../lib/filters";
import { useFollows } from "../store/follows";
import { TODAY } from "../store/data";

export function TodayStrip({
  filters,
  onOpenCalendar,
}: {
  filters: ItemFilters;
  onOpenCalendar: () => void;
}) {
  const { isFollowedOn } = useFollows();
  // 「今日追番更新」始终统计全部平台已追番条目（不受首页平台 Tab 影响），搜索/徽章筛选仍生效
  const todayItems = applyFilters(itemsOn(TODAY, "all"), filters).filter((i) => isFollowedOn(i.platform, i.title));
  return (
    <div className="today-strip">
      <span className="today-strip-label">今日追番更新 · {todayItems.length}</span>
      <div className="today-strip-body">
        {todayItems.length
          ? todayItems.map((i) => (
              <a
                key={i.id}
                href={i.url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (!i.url || i.url === "#") e.preventDefault();
                }}
              >
                <span className={`plat-dot ${i.platform}`} />
                {i.title}
              </a>
            ))
          : <span className="empty-note">今日没有追番更新 · 在看板点星标即可加入追番日历</span>}
      </div>
      <button className="btn ghost sm" onClick={onOpenCalendar}>
        <span className="btn-text">追番日历</span> <ChevronRightIcon />
      </button>
    </div>
  );
}
