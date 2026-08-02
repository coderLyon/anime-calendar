import { useState } from "react";
import { bindEmail, isSupabaseEnabled } from "../lib/supabase";
import { useSyncStatus } from "../lib/syncQueue";
import { CloudIcon } from "../lib/icons";

const LABEL: Record<string, string> = {
  disabled: "本机",
  idle: "已同步",
  syncing: "同步中",
  offline: "离线",
  error: "同步异常",
};

const SEEN_KEY = "anime-calendar.sync-seen.v1";

/** Header 轻量同步状态：无账号体系，仅提示数据归属（本机 / 云端匿名身份） */
export function SyncStatus() {
  const status = useSyncStatus();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      return true;
    }
  });
  const openPanel = () => {
    setOpen(true);
    if (!seen) {
      try {
        localStorage.setItem(SEEN_KEY, "1");
      } catch {
        /* ignore */
      }
      setSeen(true);
    }
  };
  return (
    <>
      <button
        className="icon-btn sync-status"
        title={`云同步：${LABEL[status]}`}
        aria-label={`云同步状态：${LABEL[status]}`}
        onClick={openPanel}
      >
        <CloudIcon className={`sync-${status}`} />
        {!seen ? <span className="sync-red-dot" aria-hidden="true" /> : null}
      </button>
      {open ? <SyncPanel onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function SyncPanel({ onClose }: { onClose: () => void }) {
  const status = useSyncStatus();
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async () => {
    const r = await bindEmail(email);
    setMsg(r.message);
    if (r.ok) setEmail("");
  };

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" role="dialog" aria-label="云同步设置" onClick={(e) => e.stopPropagation()}>
        <h3>云同步</h3>
        <p className="sync-desc">
          状态：<strong>{LABEL[status]}</strong>。本站无账号体系：首次访问自动创建设备级匿名身份，追番 / 屏蔽 /
          设置按设备自动同步，开箱即用；新设备或清空站点数据后即为全新身份。
        </p>
        {!isSupabaseEnabled() ? (
          <p className="sync-note">
            当前未配置云同步（VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY），数据仅保存在本机浏览器；
            配置后即可跨设备恢复。
          </p>
        ) : (
          <>
            <label className="sync-field">
              绑定邮箱（可选，跨设备恢复）
              <input
                type="email"
                value={email}
                placeholder="you@example.com"
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <button className="btn primary sm" onClick={submit} disabled={!email}>
              发送确认邮件
            </button>
            {msg ? <p className="sync-msg">{msg}</p> : null}
          </>
        )}
        <p className="sync-note">
          提示：清空浏览器站点数据后，本机匿名身份将无法找回；建议绑定邮箱，或定期在「追番」页导出 JSON 备份。
        </p>
        <button className="btn ghost sm" onClick={onClose}>
          关闭
        </button>
      </div>
    </div>
  );
}
