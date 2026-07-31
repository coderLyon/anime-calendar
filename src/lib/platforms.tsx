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
 * 平台品牌 LOGO（简化 SVG 版，源自已审批 G0 原型）。
 * M0 阶段保留；如替换为官方资源，保持外层 .plat-logo 尺寸体系。
 */
export function PlatformLogo({ platform }: { platform: PlatformKey }) {
  switch (platform) {
    case "bili":
      return (
        <span className="plat-logo">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="1.2" y="1.2" width="21.6" height="21.6" rx="6.2" fill="#FB7299" />
            <g fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6.5 9.2 5 6.6" />
              <path d="M17.5 9.2l1.5-2.6" />
              <rect x="6" y="8.4" width="12" height="8.4" rx="2" />
            </g>
          </svg>
        </span>
      );
    case "tencent":
      return (
        <span className="plat-logo">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="1.2" y="1.2" width="21.6" height="21.6" rx="6.2" fill="#FF8A00" />
            <g fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5.6 5.8 11 12l-5.4 6.2" />
              <path d="M18.4 5.8 13 12l5.4 6.2" />
            </g>
          </svg>
        </span>
      );
    case "youku":
      return (
        <span className="plat-logo">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="1.2" y="1.2" width="21.6" height="21.6" rx="6.2" fill="#F03E3E" />
            <path d="M7.2 6.8v6.3c0 2.5 2 4.5 4.5 4.5s4.5-2 4.5-4.5V6.8" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
            <path d="m10.6 10.6 2.6 1.6-2.6 1.6z" fill="#fff" />
          </svg>
        </span>
      );
    case "iqiyi":
      return (
        <span className="plat-logo">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="1.2" y="1.2" width="21.6" height="21.6" rx="6.2" fill="#00A356" />
            <g fill="#fff">
              <rect x="10.7" y="6.6" width="2.6" height="11" rx="1.3" />
              <path d="M12 4.6l3.6 2.2L12 9z" />
            </g>
          </svg>
        </span>
      );
  }
}
