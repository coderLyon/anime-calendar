export const WEEK_CN = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

/** 相对时间文案：刚刚 / N 分钟前 / N 小时前 / N 天前（M5 数据时效优化） */
export function relativeTime(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return "暂无同步";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "暂无同步";
  const diff = Math.max(0, now.getTime() - t);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

export function dstr(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function sameDay(a: Date, b: Date): boolean {
  return dstr(a) === dstr(b);
}

/** 1..7（周一=1） */
export function wdOf(d: Date): number {
  return ((d.getDay() + 6) % 7) + 1;
}

export function isoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
