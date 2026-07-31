import { PlatformLogo, PLATFORMS } from "../lib/platforms";
import { ErrIcon } from "../lib/icons";
import type { Mode, PlatformFilter } from "../types";

interface PlatformTabsProps {
  platform: PlatformFilter;
  mode: Mode;
  counts: Record<PlatformFilter, number>;
  onChange: (p: PlatformFilter) => void;
}

export function PlatformTabs({ platform, mode, counts, onChange }: PlatformTabsProps) {
  const allTab = (
    <button key="all" className={`tab ${platform === "all" ? "active" : ""}`} onClick={() => onChange("all")}>
      全部<span className="tab-count">{counts.all}</span>
    </button>
  );
  const platformTabs = PLATFORMS.map((p) => {
    if (mode === "error" && p.key === "tencent") {
      return (
        <span key={p.key} className="error-tab">
          <ErrIcon />
          腾讯<span className="tab-count">失败</span>
        </span>
      );
    }
    return (
      <button key={p.key} className={`tab ${platform === p.key ? "active" : ""}`} onClick={() => onChange(p.key)}>
        <PlatformLogo platform={p.key} />
        {p.short}
        <span className="tab-count">{counts[p.key]}</span>
      </button>
    );
  });
  return (
    <div className="tab-row">
      {allTab}
      {platformTabs}
    </div>
  );
}
