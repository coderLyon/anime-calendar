import { ErrIcon, WarnIcon } from "../lib/icons";

export function WarnBanner({ onClose }: { onClose: () => void }) {
  return (
    <div className="warn-banner">
      <WarnIcon />
      <div>
        <span className="warn-title">数据提示：</span>
        <span className="warn-body">已按规则过滤时长不足 5 分钟（&lt;300 秒）的条目；无法确认时长的条目按关键词兜底判定，详情见同步日志 warnings</span>
      </div>
      <div className="warn-actions">
        <button className="btn sm" onClick={onClose}>知道了</button>
      </div>
    </div>
  );
}

export function ErrorBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="err-banner">
      <ErrIcon />
      <div>
        <b>腾讯视频抓取失败</b>（网络超时）—— 当前展示上次成功数据，稍后自动重试
      </div>
      <div className="err-actions">
        <button className="btn danger-ghost sm" onClick={onRetry}>立即重试</button>
      </div>
    </div>
  );
}
