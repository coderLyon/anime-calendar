import { useEffect, useState } from "react";
import { BellIcon } from "../lib/icons";
import { showTodayNotifications, todayFollowedNotifyItems, unnotifiedTodayCount, useNotifiedVersion } from "../lib/notify";
import { useToast } from "./Toast";
import { useFollows } from "../store/follows";
import { useDataVersion } from "../store/data";
import { useShortFilterVersion } from "../lib/shortFilter";

/** Header 铃铛：站内角标 + 浏览器通知（用户手势授权，拒绝后仅角标） */
export function NotificationBell() {
  const toast = useToast();
  const { follows } = useFollows();
  useDataVersion();
  useShortFilterVersion();
  useNotifiedVersion();
  const todayCount = todayFollowedNotifyItems(follows).length;
  const unnotified = unnotifiedTodayCount(follows);
  const [supported] = useState(() => typeof window !== "undefined" && "Notification" in window);

  useEffect(() => {
    const check = () => {
      if (document.visibilityState === "visible") showTodayNotifications(follows);
    };
    const t = window.setTimeout(() => showTodayNotifications(follows), 2000);
    const onVis = () => check();
    document.addEventListener("visibilitychange", onVis);
    const iv = window.setInterval(() => showTodayNotifications(follows), 30 * 60 * 1000);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(iv);
    };
  }, [follows]);

  const onClick = async () => {
    if (!supported) {
      toast("当前浏览器不支持通知");
      return;
    }
    if (Notification.permission === "default") {
      const p = await Notification.requestPermission();
      if (p === "granted") {
        showTodayNotifications(follows);
        toast("已开启今日更新通知");
      } else {
        toast("未开启通知，仅显示站内角标");
      }
    } else if (Notification.permission === "granted") {
      const n = showTodayNotifications(follows);
      toast(n ? `已提醒 ${n} 部今日更新` : "今日追番更新已全部提醒过");
    } else {
      toast("通知已被拒绝，可在浏览器设置中重新开启");
    }
  };

  return (
    <button
      className="icon-btn bell-btn"
      title={`今日 ${todayCount} 部追番更新`}
      aria-label={`今日 ${todayCount} 部追番更新，点击开启通知`}
      onClick={onClick}
    >
      <BellIcon />
      {unnotified > 0 ? <span className="bell-badge">{unnotified > 99 ? "99+" : unnotified}</span> : null}
    </button>
  );
}
