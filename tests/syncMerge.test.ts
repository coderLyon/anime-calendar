import { describe, expect, it } from "vitest";
import { mergeBlocked, mergeFollows, type SyncRow } from "../src/lib/sync";
import type { BlockedMap, FollowMap } from "../src/types";

const row = (over: Partial<SyncRow> & { key: string }): SyncRow => ({ updated_at: null, deleted_at: null, ...over });

describe("follows LWW 合并", () => {
  it("本地与远端并存，远端新者胜", () => {
    const local: FollowMap = {
      a: { key: "a", title: "A-本地", platforms: [], followedAt: "2026-08-01", updatedAt: "2026-08-01T00:00:00Z" },
    };
    const remote = [row({ key: "a", title: "A-远端", updated_at: "2026-08-01T01:00:00Z", platforms: [] })];
    const { next, deletes } = mergeFollows(local, remote, new Map());
    expect(next.a.title).toBe("A-远端");
    expect(deletes.size).toBe(0);
  });

  it("本地较新时保留本地", () => {
    const local: FollowMap = {
      a: { key: "a", title: "A-本地", platforms: [], followedAt: "2026-08-01", updatedAt: "2026-08-02T00:00:00Z" },
    };
    const remote = [row({ key: "a", title: "A-远端", updated_at: "2026-08-01T01:00:00Z", platforms: [] })];
    const { next } = mergeFollows(local, remote, new Map());
    expect(next.a.title).toBe("A-本地");
  });

  it("删除墓碑较新时删除", () => {
    const local: FollowMap = {
      a: { key: "a", title: "A", platforms: [], followedAt: "2026-08-01", updatedAt: "2026-08-01T00:00:00Z" },
    };
    const remote = [row({ key: "a", title: "A", updated_at: "2026-08-01T01:00:00Z", platforms: [] })];
    const { next, deletes } = mergeFollows(local, remote, new Map([["a", "2026-08-01T02:00:00Z"]]));
    expect(next.a).toBeUndefined();
    expect(deletes.get("a")).toBe("2026-08-01T02:00:00Z");
  });

  it("远端 deleted_at 较新时同步删除", () => {
    const local: FollowMap = {
      a: { key: "a", title: "A", platforms: [], followedAt: "2026-08-01", updatedAt: "2026-08-01T00:00:00Z" },
    };
    const remote = [row({ key: "a", title: "A", updated_at: "2026-08-01T01:00:00Z", deleted_at: "2026-08-01T01:00:00Z", platforms: [] })];
    const { next, deletes } = mergeFollows(local, remote, new Map());
    expect(next.a).toBeUndefined();
    expect(deletes.get("a")).toBe("2026-08-01T01:00:00Z");
  });

  it("远端独有条目并入本地", () => {
    const remote = [row({ key: "b", title: "B", updated_at: "2026-08-01T00:00:00Z", platforms: [{ platform: "bili" }] })];
    const { next } = mergeFollows({}, remote, new Map());
    expect(next.b.platforms).toEqual([{ platform: "bili" }]);
  });
});

describe("blocked LWW 合并", () => {
  it("远端新者胜", () => {
    const local: BlockedMap = { x: { key: "x", title: "X", blockedAt: "2026-08-01" } };
    const remote = [row({ key: "x", title: "X-远端", updated_at: "2026-08-02T00:00:00Z" })];
    const { next } = mergeBlocked(local, remote, new Map());
    expect(next.x.title).toBe("X-远端");
  });

  it("本地删除墓碑生效", () => {
    const local: BlockedMap = { x: { key: "x", title: "X", blockedAt: "2026-08-01" } };
    const { next, deletes } = mergeBlocked(local, [], new Map([["x", "2026-08-02T00:00:00Z"]]));
    expect(next.x).toBeUndefined();
    expect(deletes.get("x")).toBe("2026-08-02T00:00:00Z");
  });
});
