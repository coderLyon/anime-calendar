/**
 * 豆瓣短剧甄别（计划外补充，配合「AI 短剧评论识别」使用）：
 * 对时长无法确认的优酷/爱奇艺条目做一次豆瓣影视搜索——
 * - 精确命中且「暂无评分」：AI 短剧典型画像（新上架、无评分），返回 unrated=true 供上层丢弃；
 * - 精确命中且已有评分：正规剧集（如名侦探柯南 9.0），放行；
 * - 未精确命中：存在别名/收录差异（如斗罗大陆5、师兄啊师兄），由上层保留并记警告，避免误伤。
 *
 * 反爬约束（用户提示「搜多了会触发反爬」）：调用方必须限额（默认每次同步 ≤10 次）并限速；
 * 命中安全校验页时返回 { ok:false }，上层 fail-open 保留条目。
 */
import { fetchText, normalizeTitle } from "./shared.mjs";

const SEARCH_URL = "https://www.douban.com/search";
const CAPTCHA_MARKERS = ["正在处理,请稍候", "id=\"sec\"", "sec.douban.com"];

/**
 * @param {string} title 剧集标题
 * @returns {Promise<{ok:boolean, exact:null|{title:string,type:string|null,rated:boolean,unrated:boolean,rating:number|null}}>}
 */
export async function doubanLookup(title) {
  try {
    const html = await fetchText(`${SEARCH_URL}?q=${encodeURIComponent(title)}&cat=1002`, {
      referer: "https://www.douban.com/",
      timeout: 20000,
    });
    if (html.length < 5000 || CAPTCHA_MARKERS.some((m) => html.includes(m))) {
      return { ok: false, exact: null };
    }
    return { ok: true, exact: parseDoubanHtml(html, title) };
  } catch (err) {
    return { ok: false, exact: null, error: err.message };
  }
}

/** 解析豆瓣搜索结果页：精确命中返回条目画像，未命中返回 null（导出供测试） */
export function parseDoubanHtml(html, title) {
  const blocks = splitResults(html);
  const want = normalizeTitle(title);
  for (const b of blocks) {
    const m = b.match(/<h3>[\s\S]*?<a[^>]*>([^<]+)<\/a>/);
    const t = m ? m[1].trim() : "";
    if (!t || normalizeTitle(t) !== want) continue;
    const typeM = b.match(/\[([^\]\s]+)\]/);
    const unrated = b.includes("暂无评分");
    const ratedM = b.match(/class="allstar(\d+)"/);
    return {
      title: t,
      type: typeM ? typeM[1] : null,
      unrated,
      rated: !unrated,
      rating: ratedM ? Number(ratedM[1]) / 10 : null,
    };
  }
  return null;
}

/** 切分搜索结果块：<div class="result">…</div></div>（内容区与容器各收一个 </div>） */
function splitResults(html) {
  return [...html.matchAll(/<div class="result">([\s\S]*?)<\/div>\s*<\/div>/g)].map((m) => m[1]);
}
