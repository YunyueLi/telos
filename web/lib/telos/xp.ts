// 游戏化 v1：XP 由【真实学习信号】算出(掌握的知识点 + 复习次数 + 目标点亮)，
// 不挂钩在线时长。连胜按"自然日是否有学习活动"计。守"不挤出内在动机"红线：
// XP 是进度副产品、可不显示；这里只做最小可用版。
"use client";

import type { KnowledgeGraph, LearnerState } from "./engine";

// 掌握一个知识点的 XP：越深(前置越多)越值钱；目标点额外加成。
export function computeXp(g: KnowledgeGraph, state: LearnerState, threshold = 0.8): number {
  let xp = 0;
  for (const id of g.ids()) {
    if ((state.mastery[id] ?? 0) >= threshold) {
      const weight = 10 + 5 * g.prerequisites(id).length;
      xp += g.get(id).isGoal ? weight + 50 : weight;
    }
  }
  for (const id of Object.keys(state.cards)) {
    xp += (state.cards[id]?.reps ?? 0) * 3; // 复习(按时按质的近似)
  }
  return Math.round(xp);
}

const SKEY = "telos:streak";
interface StreakState {
  count: number;
  lastDate: string;
} // lastDate = YYYY-MM-DD

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

function read(): StreakState | null {
  if (typeof window === "undefined") return null;
  try {
    const r = window.localStorage.getItem(SKEY);
    return r ? (JSON.parse(r) as StreakState) : null;
  } catch {
    return null;
  }
}

// 当前连胜(若最后活动既非今天也非昨天，视为已断 → 0)。
export function getStreak(): number {
  const s = read();
  if (!s) return 0;
  const gap = daysBetween(s.lastDate, todayStr());
  return gap <= 1 ? s.count : 0;
}

// 记录一次"今天有学习活动"，返回更新后的连胜天数。
export function touchStreak(): number {
  if (typeof window === "undefined") return 0;
  const today = todayStr();
  const s = read();
  let count = 1;
  if (s) {
    const gap = daysBetween(s.lastDate, today);
    if (gap === 0) count = s.count; // 今天已记
    else if (gap === 1) count = s.count + 1; // 连续
    else count = 1; // 断了，重新开始
  }
  try {
    window.localStorage.setItem(SKEY, JSON.stringify({ count, lastDate: today }));
  } catch {
    /* ignore */
  }
  return count;
}
