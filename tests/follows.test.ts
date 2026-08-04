import { describe, expect, it } from "vitest";
import { applyToggle, followedOn } from "../src/store/follows";
import type { AnimeItem, FollowMap } from "../src/types";

const item = (over: Partial<AnimeItem> = {}): AnimeItem => ({
  id: "x",
  platform: "bili",
  title: "搜神记",
  episode: "第1集",
  updateTime: "10:00",
  date: "2026-08-03",
  weekday: 1,
  svip: false,
  ...over,
});

describe("追番平台级标记（同标题跨平台不自动互标）", () => {
  it("标记 B站后，爱奇艺同名剧不视为已追番", () => {
    const first = applyToggle({}, item({ platform: "bili", title: "搜神记" }));
    expect(followedOn(first.next, "bili", "搜神记")).toBe(true);
    expect(followedOn(first.next, "iqiyi", "搜神记")).toBe(false);
  });

  it("再标爱奇艺 → 同一追番条目包含两个平台；再次点击移除爱奇艺", () => {
    const first = applyToggle({}, item({ platform: "bili", title: "搜神记" }));
    const second = applyToggle(first.next, item({ platform: "iqiyi", title: "搜神记" }));
    expect(followedOn(second.next, "bili", "搜神记")).toBe(true);
    expect(followedOn(second.next, "iqiyi", "搜神记")).toBe(true);
    expect(second.next["搜神记"].platforms).toHaveLength(2);

    const third = applyToggle(second.next, item({ platform: "iqiyi", title: "搜神记" }));
    expect(followedOn(third.next, "bili", "搜神记")).toBe(true);
    expect(followedOn(third.next, "iqiyi", "搜神记")).toBe(false);
    expect(third.next["搜神记"].platforms).toHaveLength(1);
  });

  it("移除最后一个平台时删除整个追番条目", () => {
    const first = applyToggle({}, item({ platform: "bili", title: "搜神记" }));
    const second = applyToggle(first.next, item({ platform: "bili", title: "搜神记" }));
    expect(second.op).toBe("delete");
    expect(second.next["搜神记"]).toBeUndefined();
  });

  it("旧数据（platforms 数组）兼容判断", () => {
    const follows: FollowMap = {
      搜神记: {
        key: "搜神记",
        title: "搜神记",
        followedAt: "2026-08-01",
        platforms: [{ platform: "bili", url: "#", episode: "第1集" }],
      },
    };
    expect(followedOn(follows, "bili", "搜神记")).toBe(true);
    expect(followedOn(follows, "iqiyi", "搜神记")).toBe(false);
  });
});
