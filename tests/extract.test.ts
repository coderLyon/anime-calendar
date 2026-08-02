import { describe, expect, it } from "vitest";
import { extractDurations } from "../scripts/youku.mjs";
import { parseEpisodeList } from "../scripts/tencent.mjs";

describe("优酷时长提取", () => {
  it("数值秒（含小数）", () => {
    expect(extractDurations('"duration":174.04')).toBe(174.04);
    expect(extractDurations('"duration":349.5')).toBe(349.5);
  });

  it("ISO 8601 分秒与时分秒", () => {
    expect(extractDurations('"duration":"PT5M49.5S"')).toBe(349.5);
    expect(extractDurations('"duration":"PT1H2M3S"')).toBe(3723);
    expect(extractDurations('"duration":"PT0M59.47S"')).toBe(59.47);
  });

  it("毫秒字段归一为秒", () => {
    expect(extractDurations('"duration_msec":870000')).toBe(870);
    expect(extractDurations('"duration":1206532')).toBe(1207);
  });

  it("多字段取最大值", () => {
    const html = '"duration":174.04 "duration":"PT5M49.5S" "duration_msec":870000';
    expect(extractDurations(html)).toBe(870);
  });

  it("无时长字段返回 null", () => {
    expect(extractDurations("<html>无字段</html>")).toBeNull();
    expect(extractDurations("")).toBeNull();
  });
});

describe("腾讯分集时长解析", () => {
  const sample = JSON.stringify({
    data: {
      module_list_datas: [
        {
          module_datas: [
            {
              item_data_lists: {
                item_datas: [
                  { item_id: "a1", item_params: { play_title: "无上神帝 第600话", union_title: "无上神帝_600", duration: "450" } },
                  { item_id: "a2", item_params: { play_title: "无上神帝 第601话", union_title: "无上神帝_601", duration: "468" } },
                  { item_id: "b1", item_params: { play_title: "无上神帝 预告", union_title: "无上神帝_预告", duration: "90" } },
                  { item_id: "c1", item_params: { play_title: "无上神帝 彩蛋", union_title: "无上神帝_彩蛋", duration: "30" } },
                  { item_id: "empty", item_params: { play_title: "", union_title: "", duration: "" } },
                ],
              },
            },
          ],
        },
      ],
    },
  });

  it("解析每集 vid/集数/时长，标记花絮", () => {
    const list = parseEpisodeList(sample);
    expect(list).toHaveLength(4);
    const ep601 = list.find((x) => x.epNum === 601);
    expect(ep601?.duration).toBe(468);
    expect(ep601?.vid).toBe("a2");
    expect(list.find((x) => x.epNum === 600)?.extra).toBe(false);
    expect(list.find((x) => x.title.includes("预告"))?.extra).toBe(true);
  });

  it("季号不会误当集数（斩神之凡尘神域 第2季 第08话 → 8）", () => {
    const sample = JSON.stringify({
      data: {
        module_list_datas: [
          {
            module_datas: [
              {
                item_data_lists: {
                  item_datas: [
                    { item_id: "v1", item_params: { play_title: "斩神之凡尘神域 第2季 第08话", union_title: "斩神之凡尘神域 第2季_8", duration: "900" } },
                  ],
                },
              },
            ],
          },
        ],
      },
    });
    const list = parseEpisodeList(sample);
    expect(list[0]?.epNum).toBe(8);
  });

  it("损坏响应返回空列表", () => {
    expect(parseEpisodeList("not json")).toEqual([]);
    expect(parseEpisodeList("{}")).toEqual([]);
  });
});
