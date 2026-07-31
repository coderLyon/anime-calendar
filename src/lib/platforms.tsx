import type { PlatformKey } from "../types";

export interface PlatformInfo {
  key: PlatformKey;
  name: string;
  short: string;
  color: string;
}

export const PLATFORMS: PlatformInfo[] = [
  { key: "bili", name: "哔哩哔哩", short: "B站", color: "#FB7299" },
  { key: "tencent", name: "腾讯视频", short: "腾讯", color: "#FF8A00" },
  { key: "youku", name: "优酷", short: "优酷", color: "#F03E3E" },
  { key: "iqiyi", name: "爱奇艺", short: "爱奇艺", color: "#00A356" },
];

export const PLAT_MAP = Object.fromEntries(PLATFORMS.map((p) => [p.key, p])) as Record<PlatformKey, PlatformInfo>;

export function platShort(key: PlatformKey): string {
  return PLAT_MAP[key].short;
}

/**
 * 平台品牌 LOGO（官方 favicon 资源，随仓库静态托管于 public/logos/）。
 * 保持外层 .plat-logo 尺寸体系（Tab 17px / chip 15px）。
 */
export function PlatformLogo({ platform }: { platform: PlatformKey }) {
  const src = `${import.meta.env.BASE_URL}logos/${platform}.png`;
  return (
    <span className="plat-logo">
      <img src={src} alt={PLAT_MAP[platform].name} />
    </span>
  );
}
