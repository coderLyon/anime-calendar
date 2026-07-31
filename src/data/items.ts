import type { AnimeItem } from "../types";

/**
 * 示例数据（G0 审批版本）：结构与 M1 管道输出的 AnimeItem 完全一致。
 * M1 上线后由 data/updates.json 驱动，此文件仅用于开发与设计验收。
 */
export const SAMPLE_ITEMS: AnimeItem[] = [
  { id: "b1", platform: "bili", title: "凡人修仙传·年番", episode: "第98话", updateTime: "20:00", weekday: 6, date: "2026-08-01", svip: false, badge: "独播", duration: 1440 },
  { id: "b2", platform: "bili", title: "时光代理人·英都篇", episode: "第7话", updateTime: "20:00", weekday: 5, date: "2026-07-31", svip: false, badge: "独播", duration: 1380 },
  { id: "b3", platform: "bili", title: "仙逆", episode: "第47话", updateTime: "20:00", weekday: 1, date: "2026-07-27", svip: false, badge: "独播", duration: 1420 },
  { id: "b4", platform: "bili", title: "镇魂街·第四季", episode: "第4话", updateTime: "20:00", weekday: 4, date: "2026-07-30", svip: false, badge: "独播", duration: 1350 },
  { id: "b5", platform: "bili", title: "一念永恒·第三季", episode: "第58话", updateTime: "20:00", weekday: 3, date: "2026-07-29", svip: false, badge: null, duration: 1400 },
  { id: "b6", platform: "bili", title: "万古神话", episode: "第312话", updateTime: "20:00", weekday: 2, date: "2026-07-28", svip: false, badge: null, duration: 1320 },
  { id: "t1", platform: "tencent", title: "斗破苍穹·年番", episode: "第143集", updateTime: "10:00", weekday: 7, date: "2026-08-02", svip: true, badge: "SVIP抢先", duration: 1450 },
  { id: "t2", platform: "tencent", title: "完美世界", episode: "第212集", updateTime: "10:00", weekday: 6, date: "2026-08-01", svip: true, badge: "SVIP抢先", duration: 1480 },
  { id: "t3", platform: "tencent", title: "遮天", episode: "第88集", updateTime: "10:00", weekday: 5, date: "2026-07-31", svip: false, badge: null, duration: 1400 },
  { id: "t4", platform: "tencent", title: "斗罗大陆II绝世唐门", episode: "第122集", updateTime: "10:00", weekday: 3, date: "2026-07-29", svip: true, badge: "SVIP抢先", duration: 1420 },
  { id: "t5", platform: "tencent", title: "神印王座", episode: "第110集", updateTime: "10:00", weekday: 2, date: "2026-07-28", svip: false, badge: null, duration: 1380 },
  { id: "t6", platform: "tencent", title: "大主宰·年番", episode: "第88集", updateTime: "10:00", weekday: 1, date: "2026-07-27", svip: false, badge: null, duration: 1360 },
  { id: "t7", platform: "tencent", title: "剑来", episode: "第66集", updateTime: "12:00", weekday: 4, date: "2026-07-30", svip: false, badge: null, duration: 1390 },
  { id: "y1", platform: "youku", title: "沧元图", episode: "第30集", updateTime: "10:00", weekday: 3, date: "2026-07-29", svip: false, badge: "独播", duration: 1410 },
  { id: "y2", platform: "youku", title: "师兄啊师兄", episode: "第58集", updateTime: "10:00", weekday: 4, date: "2026-07-30", svip: false, badge: "独播", duration: 1370 },
  { id: "y3", platform: "youku", title: "百炼成神", episode: "第102集", updateTime: "10:00", weekday: 2, date: "2026-07-28", svip: false, badge: null, duration: 1340 },
  { id: "y4", platform: "youku", title: "神墓", episode: "第46集", updateTime: "10:00", weekday: 6, date: "2026-08-01", svip: false, badge: "独播", duration: 1425 },
  { id: "y5", platform: "youku", title: "火凤燎原", episode: "第31集", updateTime: "10:00", weekday: 5, date: "2026-07-31", svip: false, badge: "独播", duration: 1430 },
  { id: "y6", platform: "youku", title: "少年歌行·风花雪月篇", episode: "第24集", updateTime: "10:00", weekday: 7, date: "2026-08-02", svip: false, badge: "独播", duration: 1445 },
  { id: "i1", platform: "iqiyi", title: "大主宰·年番", episode: "第88集", updateTime: "10:00", weekday: 1, date: "2026-07-27", svip: false, badge: "限免", duration: 1360 },
  { id: "i2", platform: "iqiyi", title: "万界独尊", episode: "第180集", updateTime: "10:00", weekday: 4, date: "2026-07-30", svip: false, badge: null, duration: 1330 },
  { id: "i3", platform: "iqiyi", title: "绝世武魂", episode: "第220集", updateTime: "10:00", weekday: 5, date: "2026-07-31", svip: false, badge: null, duration: 1355 },
  { id: "i4", platform: "iqiyi", title: "洪荒战神", episode: "第160集", updateTime: "10:00", weekday: 3, date: "2026-07-29", svip: false, badge: null, duration: 1325 },
  { id: "i5", platform: "iqiyi", title: "灵笼2", episode: "第12集", updateTime: "10:00", weekday: 6, date: "2026-08-01", svip: false, badge: "独播", duration: 1470 },
  { id: "i6", platform: "iqiyi", title: "幻塔", episode: "第36集", updateTime: "10:00", weekday: 2, date: "2026-07-28", svip: false, badge: null, duration: 1310 },
  { id: "i7", platform: "iqiyi", title: "神澜奇域无双珠", episode: "第66集", updateTime: "10:00", weekday: 7, date: "2026-08-02", svip: false, badge: "限免", duration: 1365 },
];

/** 示例数据周起点（周一）与“今天”（用于开发环境时间基准） */
export const SAMPLE_WEEK_START = new Date(2026, 6, 27);
export const SAMPLE_TODAY = new Date(2026, 6, 31);
