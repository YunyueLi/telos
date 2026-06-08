// 游戏化 v2：XP 由【真实学习信号】算出（掌握的知识点 + 复习次数 + 目标点亮），
// 在此之上做：每日目标 + 连胜 + 断签保护（freeze）。守"不挤出内在动机"红线——
// XP 永远绑真实学习信号、绝不绑在线时长；Telos 结构上无法"刷连胜"（掌握靠 BKT 阈值、
// 复习靠 FSRS 到期）。每日目标可调可"轻松档"、低压力、不用愧疚式暗黑模式。
// 数据落本地 localStorage(telos:daily)：{days: 每日XP流水, goal, freezes, frozen, rewarded}。
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

// ---- 每日进度存储 ----
const DKEY = "telos:daily";
const LEGACY = "telos:streak"; // 旧版只存 {count,lastDate}
export const MAX_FREEZE = 2; // 最多持有的断签保护（与 Duolingo 同）
export const DEFAULT_GOAL = 20;
export const GOAL_OPTIONS = [10, 20, 40, 60]; // 轻松 / 常规 / 认真 / 硬核
const FREEZE_EVERY = 5; // 连胜每 +5 天里程碑奖励 1 个 freeze（封顶 MAX_FREEZE）
const DERIVE_XP = 8; // 倒推一张新蓝图给的小额参与 XP（不足以单独达标，须真学习）

export interface Daily {
  days: Record<string, number>; // YYYY-MM-DD -> 当日获得 XP
  goal: number;
  freezes: number; // 可用断签保护数
  frozen: string[]; // 已被 freeze 自动保护的日期
  rewarded: number; // 已奖励过 freeze 的最高连胜里程碑
}

export interface DayCell {
  date: string;
  xp: number;
  met: boolean; // 达成当日目标
  partial: boolean; // 有学习但未达标
  frozen: boolean; // 被 freeze 保护
  today: boolean;
  weekday: number; // 0=周日 .. 6=周六
}

export interface DailyInfo {
  xp: number; // 今日已得
  goal: number;
  pct: number; // 0..1
  streak: number;
  freezes: number;
  goalMet: boolean;
}

// ---- 本地日期工具（用本地时区，贴合用户对"今天"的感知；diff 用 UTC 避免 DST）----
function pad(n: number): string {
  return n < 10 ? "0" + n : String(n);
}
function fmt(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function today(): string {
  return fmt(new Date());
}
function shift(date: string, delta: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return fmt(dt);
}
function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

function fresh(): Daily {
  return { days: {}, goal: DEFAULT_GOAL, freezes: 0, frozen: [], rewarded: 0 };
}

function normalize(o: unknown): Daily {
  const d = (o ?? {}) as Partial<Daily>;
  return {
    days: d.days && typeof d.days === "object" ? { ...d.days } : {},
    goal: typeof d.goal === "number" && d.goal > 0 ? d.goal : DEFAULT_GOAL,
    freezes: Math.max(0, Math.min(MAX_FREEZE, typeof d.freezes === "number" ? d.freezes : 0)),
    frozen: Array.isArray(d.frozen) ? [...d.frozen] : [],
    rewarded: typeof d.rewarded === "number" ? d.rewarded : 0,
  };
}

// 从旧 telos:streak 迁移：把最后 count 天补成"达标"，保住可见连胜与日历观感（无法还原真实历史，尽力近似）。
function migrate(): Daily {
  const d = fresh();
  if (typeof window === "undefined") return d;
  try {
    const raw = window.localStorage.getItem(LEGACY);
    if (raw) {
      const s = JSON.parse(raw) as { count?: number; lastDate?: string };
      if (s?.count && s.count > 0 && s.lastDate) {
        for (let i = 0; i < s.count; i++) d.days[shift(s.lastDate, -i)] = d.goal;
      }
    }
  } catch {
    /* ignore */
  }
  return d;
}

function readRaw(): Daily {
  if (typeof window === "undefined") return fresh();
  try {
    const raw = window.localStorage.getItem(DKEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return migrate();
}

function persist(d: Daily): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DKEY, JSON.stringify(d));
  } catch {
    /* ignore */
  }
}

function met(d: Daily, date: string): boolean {
  return (d.days[date] ?? 0) >= d.goal;
}
function covered(d: Daily, date: string): boolean {
  return met(d, date) || d.frozen.includes(date);
}

// 用可用 freeze 桥接"完全可补"的历史缺口（夹在两段已覆盖日之间、长度 ≤ 可用 freeze）。幂等。
function reconcile(d: Daily): void {
  let cursor = today();
  if (!covered(d, cursor)) cursor = shift(cursor, -1); // 今天还没做：宽限，从昨天起算
  let guard = 0;
  while (guard++ < 800) {
    if (covered(d, cursor)) {
      cursor = shift(cursor, -1);
      continue;
    }
    // cursor 是未覆盖的过去日 → 量这段连续缺口
    let gap = 0;
    let probe = cursor;
    while (!covered(d, probe) && gap <= MAX_FREEZE) {
      gap++;
      probe = shift(probe, -1);
    }
    // 只有缺口能被现有 freeze 完全填平、且其前方仍接着一段已覆盖日时，才消耗 freeze（否则连胜本就断了，留着 freeze）
    if (gap <= d.freezes && covered(d, probe)) {
      let g = cursor;
      for (let i = 0; i < gap; i++) {
        d.frozen.push(g);
        d.freezes -= 1;
        g = shift(g, -1);
      }
      cursor = probe;
    } else break;
  }
}

function streakOf(d: Daily): number {
  let cursor = today();
  if (!covered(d, cursor)) cursor = shift(cursor, -1);
  let n = 0;
  let guard = 0;
  while (covered(d, cursor) && guard++ < 4000) {
    n++;
    cursor = shift(cursor, -1);
  }
  return n;
}

// 读 + 对账 + 落盘（若有变化 / 首次迁移）。所有公开读经此。
function load(): Daily {
  const hadKey = typeof window !== "undefined" && window.localStorage.getItem(DKEY) !== null;
  const d = readRaw();
  const sig = d.freezes + "|" + d.frozen.join(",");
  reconcile(d);
  if (!hadKey || d.freezes + "|" + d.frozen.join(",") !== sig) persist(d);
  return d;
}

export function getDailyInfo(): DailyInfo {
  const d = load();
  const xp = d.days[today()] ?? 0;
  return {
    xp,
    goal: d.goal,
    pct: d.goal > 0 ? Math.min(1, xp / d.goal) : 0,
    streak: streakOf(d),
    freezes: d.freezes,
    goalMet: xp >= d.goal,
  };
}

export function getStreak(): number {
  return streakOf(load());
}

// 记一次真实学习获得的 XP（delta）。返回更新后的连胜 + 是否刚好达成今日目标（用于一次性庆祝）。
export function addDailyXp(amount: number): { streak: number; goalMet: boolean; justMetGoal: boolean } {
  const d = readRaw();
  const t = today();
  const before = d.days[t] ?? 0;
  if (amount > 0) d.days[t] = before + amount;
  const after = d.days[t] ?? 0;
  reconcile(d);
  const streak = streakOf(d);
  // 里程碑奖励 freeze：连胜每跨过一个 +FREEZE_EVERY 的台阶给 1 个（封顶 MAX_FREEZE）；连胜归零则重置奖励基准。
  if (streak === 0) d.rewarded = 0;
  else {
    const milestone = Math.floor(streak / FREEZE_EVERY) * FREEZE_EVERY;
    if (milestone > d.rewarded) {
      if (d.freezes < MAX_FREEZE) d.freezes = Math.min(MAX_FREEZE, d.freezes + 1);
      d.rewarded = milestone;
    }
  }
  persist(d);
  return { streak, goalMet: after >= d.goal, justMetGoal: amount > 0 && before < d.goal && after >= d.goal };
}

// 倒推新蓝图：给一点参与 XP（不足以单独达标）。
export function noteDerive(): { streak: number; goalMet: boolean; justMetGoal: boolean } {
  return addDailyXp(DERIVE_XP);
}

export function setDailyGoal(goal: number): void {
  const d = readRaw();
  d.goal = goal > 0 ? goal : DEFAULT_GOAL;
  reconcile(d);
  persist(d);
}

// 最近 n 天的格子（旧 → 新，含今天），供打卡日历渲染。
export function recentDays(n: number): DayCell[] {
  const d = load();
  const t = today();
  const cells: DayCell[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const date = shift(t, -i);
    const xp = d.days[date] ?? 0;
    const isMet = xp >= d.goal;
    cells.push({
      date,
      xp,
      met: isMet,
      partial: !isMet && xp > 0,
      frozen: d.frozen.includes(date),
      today: date === t,
      weekday: weekdayOf(date),
    });
  }
  return cells;
}
