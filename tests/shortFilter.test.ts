import { beforeEach, describe, expect, it } from "vitest";
import { applyShortFilter, setBlockedTitles, setShortFilter } from "../src/lib/shortFilter";
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

describe("短剧过滤", () => {
  beforeEach(() => {
    setShortFilter({ enabled: true, thresholdSec: 300 });
    setBlockedTitles([]);
  });

  it("开启时隐藏不足阈值条目、保留未知时长", () => {
    const list = [item({ duration: 299 }), item({ duration: 300 }), item({ duration: undefined })];
    expect(applyShortFilter(list)).toHaveLength(2);
  });

  it("关闭时展示全部", () => {
    setShortFilter({ enabled: false, thresholdSec: 300 });
    expect(applyShortFilter([item({ duration: 59 }), item({ duration: 900 })])).toHaveLength(2);
  });

  it("屏蔽标题任意阈值下隐藏", () => {
    setBlockedTitles(["测试番剧"]);
    expect(applyShortFilter([item({ duration: 900 })])).toHaveLength(0);
  });

  it("优酷断句标点标题隐藏", () => {
    expect(applyShortFilter([item({ platform: "youku", title: "开局签到，无敌" })])).toHaveLength(0);
    expect(applyShortFilter([item({ platform: "youku", title: "是王者啊？第六季" })])).toHaveLength(1);
  });
});
