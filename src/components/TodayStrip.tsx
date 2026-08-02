import { ChevronRightIcon } from "../lib/icons";
import { itemsOn } from "../lib/items";
import { applyFilters, type ItemFilters } from "../lib/filters";
import { normTitle, useFollows } from "../store/follows";
import { TODAY } from "../store/data";
import type { PlatformFilter } from "../types";

export function TodayStrip({
  platform,
  filters,
  onOpenCalendar,
}: {
  platform: PlatformFilter;
  filters: ItemFilters;
  onOpenCalendar: () => void;
}) {
  const { follows } = useFollows();
  const todayItems = applyFilters(itemsOn(TODAY, platform), filters).filter((i) => follows[normTitle(i.title)]);
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
        追番日历 <ChevronRightIcon />
      </button>
    </div>
  );
}
