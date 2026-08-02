import { describe, expect, it } from "vitest";
import { HISTORY_WEEKS, mergeHistory, mondayOf, realItemsFrom } from "../scripts/history.mjs";

describe("历史归档", () => {
  it("mondayOf 计算自然周周一", () => {
    expect(mondayOf("2026-07-29")).toBe("2026-07-27");
    expect(mondayOf("2026-08-02")).toBe("2026-07-27");
    expect(mondayOf("2026-07-27")).toBe("2026-07-27");
  });

  it("滚动保留最近 8 周且按周倒序", () => {
    const weeks = ["2026-06-01", "2026-06-08", "2026-06-15", "2026-06-22", "2026-06-29", "2026-07-06", "2026-07-13", "2026-07-20", "2026-07-27", "2026-08-03"];
    const items = weeks.map((w, i) => ({ id: `i-${i}`, date: w }));
    const out = mergeHistory(items, null, HISTORY_WEEKS);
    expect(out.weeks).toHaveLength(8);
    expect(out.weeks[0].weekStart).toBe("2026-08-03");
    expect(out.weeks[7].weekStart).toBe("2026-06-15");
  });

  it("同 id 同一周去重覆盖", () => {
    const out = mergeHistory(
      [
        { id: "a", date: "2026-07-27" },
        { id: "a", date: "2026-07-28" },
      ],
      null,
    );
    expect(out.weeks[0].items).toHaveLength(1);
  });

  it("realItemsFrom 排除 predicted", () => {
    const updates = {
      platforms: [
        {
          items: [
            { id: "real", date: "2026-07-27" },
            { id: "pred", date: "2026-08-03", predicted: true },
          ],
        },
      ],
    };
    expect(realItemsFrom(updates)).toHaveLength(1);
  });
});
