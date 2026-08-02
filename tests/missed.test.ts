import { describe, expect, it } from "vitest";
import { addDays, dstr } from "../src/lib/date";
import { missKey, missedOn, parseRule } from "../src/lib/missed";
import { TODAY, WEEK_START } from "../src/store/data";
import type { AnimeItem, FollowMap } from "../src/types";

describe("rule 解析", () => {
  it("每周一、五10:00更新1集", () => {
    const r = parseRule("每周一、五10:00更新1集，新篇章3月9日开始更新");
    expect(r).not.toBeNull();
    expect([...(r?.days ?? [])].sort()).toEqual([1, 5]);
    expect(r?.time).toBe("10:00");
  });

  it("每周二18点抢先看", () => {
    const r = parseRule("每周二18点抢先看");
    expect([...(r?.days ?? [])].sort()).toEqual([2]);
    expect(r?.time).toBe("18:00");
  });

  it("每日0点更新 → 全周", () => {
    const r = parseRule("每日0点更新");
    expect(r?.days.size).toBe(7);
    expect(r?.time).toBe("00:00");
  });

  it("无规则返回 null", () => {
    expect(parseRule(null)).toBeNull();
    expect(parseRule("每周更新")).toBeNull();
  });
});

describe("断更检测", () => {
  const tue = addDays(WEEK_START, 1);
  const items: AnimeItem[] = [
    {
      id: "t",
      platform: "tencent",
      title: "仙逆",
      episode: "第10集",
      updateTime: "10:00",
      date: dstr(tue),
      weekday: 2,
      svip: false,
      rule: "每周一、二10:00更新1集",
      finished: false,
    },
  ];
  const follows: FollowMap = {
    仙逆: { key: "仙逆", title: "仙逆", platforms: [{ platform: "tencent", url: "#", episode: "第10集" }], followedAt: "2026-08-01" },
  };

  it("规则日当天无更新 → 疑似断更", () => {
    expect(missedOn(WEEK_START, follows, items, new Set())).toHaveLength(1);
  });

  it("有更新则不断更", () => {
    const withMonday = [...items, { ...items[0], id: "t2", date: dstr(WEEK_START) }];
    expect(missedOn(WEEK_START, follows, withMonday, new Set())).toHaveLength(0);
  });

  it("已完结不检测", () => {
    const finished = items.map((i) => ({ ...i, finished: true }));
    expect(missedOn(WEEK_START, follows, finished, new Set())).toHaveLength(0);
  });

  it("忽略后不再提示", () => {
    expect(missedOn(WEEK_START, follows, items, new Set([missKey("仙逆", dstr(WEEK_START))]))).toHaveLength(0);
  });

  it("TODAY 之前未到更新时间不误报（当天规则时间未到）", () => {
    const late = addDays(WEEK_START, 3); // 周四，无规则
    expect(missedOn(late, follows, items, new Set())).toHaveLength(0);
  });

  it("SVIP 抢先剧：常规日无条目不算断更（本周已提前更新）", () => {
    // 周日 SVIP 抢先、周二 VIP 常规：周日已有条目时周二不再误报
    const sunday = addDays(WEEK_START, 6);
    const tuesday = addDays(WEEK_START, 1);
    const svipItems: AnimeItem[] = [
      {
        id: "sv",
        platform: "tencent",
        title: "吞噬星空",
        episode: "第234集",
        updateTime: "18:00",
        date: dstr(sunday),
        weekday: 7,
        svip: true,
        rule: "每周日18点SVIP抢先看，周二10点更新",
        finished: false,
      },
    ];
    const svipFollows: FollowMap = {
      吞噬星空: { key: "吞噬星空", title: "吞噬星空", platforms: [{ platform: "tencent", url: "#", episode: "第234集" }], followedAt: "2026-08-01" },
    };
    expect(missedOn(tuesday, svipFollows, svipItems, new Set())).toHaveLength(0);
    // 若本周尚无任何条目（规则条目落在上周），则仍判定断更
    const lastWeek = svipItems.map((i) => ({ ...i, id: "sv2", date: dstr(addDays(WEEK_START, -7)) }));
    expect(missedOn(sunday, svipFollows, lastWeek, new Set())).toHaveLength(1);
  });
});
