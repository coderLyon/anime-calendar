/** 腾讯防复发：斩神/茶啊二中为正片时长（>300s），季号不误当集数 */
import { scrape } from "../tencent.mjs";

const r = await scrape({ fetchLimit: 40, log: (m) => console.log("[tencent]", m) });
for (const it of r.items.filter((i) => /斩神|茶啊/.test(i.title))) {
  console.log(`CHECK ${it.title} | ${it.episode} | ${it.duration}s`);
  if (it.duration == null || it.duration < 300) {
    console.error(`FAIL: ${it.title} 时长异常（${it.duration}s）`);
    process.exit(1);
  }
}
console.log("PASS: 腾讯时长匹配正常（含季号标题）");
