"use client";

// 偏好修改时间戳（零依赖）。仅当用户【主动改偏好】时 bump：语言 / 主题皮 / 看板娘形象 /
// 每日目标 / 用墨兑换冻结。跨设备合并时用它给「偏好类」字段做 last-write-wins——
// 而连胜历史 / 打卡 / 墨累计 / 解锁记录走【无损合并】（并集取大），绝不看它、绝不丢。
const KEY = "telos:prefs-rev";

export function bumpPrefs(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function getPrefsRev(): number {
  if (typeof window === "undefined") return 0;
  try {
    return Number(window.localStorage.getItem(KEY)) || 0;
  } catch {
    return 0;
  }
}

export function setPrefsRev(n: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, String(n));
  } catch {
    /* ignore */
  }
}
