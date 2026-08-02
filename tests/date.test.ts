import { describe, expect, it } from "vitest";
import { addDays, dstr, relativeTime, wdOf } from "../src/lib/date";

describe("date helpers", () => {
  it("addDays/dstr 与周几映射", () => {
    const mon = new Date(2026, 6, 27); // 2026-07-27 周一
    expect(wdOf(mon)).toBe(1);
    expect(dstr(mon)).toBe("2026-07-27");
    expect(dstr(addDays(mon, 6))).toBe("2026-08-02");
  });

  it("relativeTime 分档", () => {
    const now = new Date("2026-08-02T10:00:00+08:00");
    expect(relativeTime(new Date("2026-08-02T09:59:30+08:00").toISOString(), now)).toBe("刚刚");
    expect(relativeTime(new Date("2026-08-02T09:30:00+08:00").toISOString(), now)).toBe("30 分钟前");
    expect(relativeTime(new Date("2026-08-02T02:00:00+08:00").toISOString(), now)).toBe("8 小时前");
    expect(relativeTime("2026-07-30T02:00:00+08:00", now)).toBe("3 天前");
    expect(relativeTime(null, now)).toBe("暂无同步");
  });
});
