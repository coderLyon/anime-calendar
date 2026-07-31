/** 示例数据海报占位（M1 起由 updates.json 的真实海报 URL 替代） */
export function posterStyle(title: string): string {
  let h = 0;
  for (const ch of title) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  const hue = h % 360;
  return `background:linear-gradient(158deg,hsl(${hue} 56% 52%),hsl(${(hue + 44) % 360} 54% 34%))`;
}

export function posterGlyph(title: string): string {
  return title.replace(/[·．]/g, "").slice(0, 2);
}
