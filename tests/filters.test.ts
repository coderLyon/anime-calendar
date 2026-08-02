import { describe, expect, it } from "vitest";
import { applyFilters, itemBadges, matchesFilters, type ItemFilters } from "../src/lib/filters";
import { formatTotal } from "../src/lib/items";
import type { AnimeItem } from "../src/types";

const item = (over: Partial<AnimeItem> = {}): AnimeItem => ({
  id: "x",
  platform: "bili",
  title: "测试番剧",
  episode: "第1集",
  updateTime: "10:00",
  date: "2026-08-02",
  weekday: 7,
  svip: false,
  ...over,
});

const F = (over: Partial<ItemFilters> = {}): ItemFilters => ({ query: "", badges: new Set(), ongoingOnly: false, ...over });

describe("搜索与筛选", () => {
  it("itemBadges 输出徽章", () => {
    expect(itemBadges(item({ svip: true }))).toContain("SVIP抢先");
    expect(itemBadges(item({ badge: "独播" }))).toContain("独播");
    expect(itemBadges(item({ finished: true }))).toContain("完结");
    // 点映合并为一个维度；大结局并入完结
    expect(itemBadges(item({ badge: "结局点映", finished: true }))).toEqual(["点映", "完结"]);
    expect(itemBadges(item({ badge: "大结局" }))).toEqual(["完结"]);
    expect(itemBadges(item({ badge: "超前点映" }))).toEqual(["点映"]);
    // 限免变体（限免中 / 逐集限免）与多徽章写法都能命中
    expect(itemBadges(item({ badge: "限免中" }))).toContain("限免");
    expect(itemBadges(item({ badge: "逐集限免" }))).toContain("限免");
    expect(itemBadges(item({ badge: "独播、限免中" }))).toEqual(["独播", "限免"]);
  });

  it("标题搜索忽略标点与大小写", () => {
    expect(matchesFilters(item({ title: "斗罗大陆 第二季" }), F({ query: "斗罗大陆第二季" }))).toBe(true);
    expect(matchesFilters(item(), F({ query: "不存在的剧" }))).toBe(false);
  });

  it("徽章筛选为或关系", () => {
    const f = F({ badges: new Set(["独播", "点映"]) });
    expect(matchesFilters(item({ badge: "独播" }), f)).toBe(true);
    expect(matchesFilters(item({ badge: "结局点映" }), f)).toBe(true);
    expect(matchesFilters(item({ badge: "超前点映" }), f)).toBe(true);
    expect(matchesFilters(item({ badge: "逐集限免" }), F({ badges: new Set(["限免"]) }))).toBe(true);
    expect(matchesFilters(item({ svip: true }), f)).toBe(false);
  });

  it("只看连载排除完结与大结局", () => {
    const f = F({ ongoingOnly: true });
    expect(matchesFilters(item(), f)).toBe(true);
    expect(matchesFilters(item({ finished: true }), f)).toBe(false);
    expect(matchesFilters(item({ badge: "大结局" }), f)).toBe(false);
  });

  it("applyFilters 组合生效", () => {
    const list = [
      item({ title: "仙逆", svip: true }),
      item({ title: "吞噬星空", badge: "独播、限免中" }),
      item({ title: "凡人修仙传", finished: true }),
    ];
    const out = applyFilters(list, F({ badges: new Set(["限免"]) }));
    expect(out.map((i) => i.title)).toEqual(["吞噬星空"]);
    expect(applyFilters(list, F({ query: "修仙" })).map((i) => i.title)).toEqual(["凡人修仙传"]);
  });

  it("formatTotal 按平台单位展示总集数", () => {
    expect(formatTotal({ platform: "bili", total: 34 })).toBe("共34话");
    expect(formatTotal({ platform: "youku", total: 90 })).toBe("共90话");
    expect(formatTotal({ platform: "tencent", total: 234 })).toBe("共234集");
    expect(formatTotal({ platform: "iqiyi", total: 203 })).toBe("共203集");
    expect(formatTotal({ platform: "bili", total: 0 })).toBeNull();
    expect(formatTotal({ platform: "bili", total: undefined })).toBeNull();
  });
});
