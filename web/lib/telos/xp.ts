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
export const FREEZE_COST = 200; // 用累积 XP 兑换 1 个断签保护（约 10 天常规努力）；花费单独记 spent，等级始终按毛 totalXp、不掉级
const DERIVE_XP = 8; // 倒推一张新蓝图给的小额参与 XP（不足以单独达标，须真学习）

export interface Daily {
  days: Record<string, number>; // YYYY-MM-DD -> 当日获得 XP
  goal: number;
  freezes: number; // 可用断签保护数
  frozen: string[]; // 已被 freeze 自动保护的日期
  rewarded: number; // 已奖励过 freeze 的最高连胜里程碑
  spent: number; // 已花费的 XP（兑换 freeze 等）；等级始终按毛 totalXp，花费不掉级
}

export interface DayCell {
  date: string;
  day: number; // 月内日期号 1..31
  xp: number;
  met: boolean; // 达成当日目标
  partial: boolean; // 有学习但未达标
  frozen: boolean; // 被 freeze 保护
  today: boolean;
  future: boolean; // 今天之后（不可达，淡显）
  weekday: number; // 0=周日 .. 6=周六
}

export interface DailyInfo {
  xp: number; // 今日已得
  goal: number;
  pct: number; // 0..1
  streak: number;
  freezes: number;
  goalMet: boolean;
  spendable: number; // 可花费 XP（累计 totalXp − 已花费 spent）
  freezeCost: number; // 兑换 1 个断签保护的 XP
  canRedeem: boolean; // 可兑换（XP 够 且 未达保护上限）
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
function fresh(): Daily {
  return { days: {}, goal: DEFAULT_GOAL, freezes: 0, frozen: [], rewarded: 0, spent: 0 };
}

function normalize(o: unknown): Daily {
  const d = (o ?? {}) as Partial<Daily>;
  return {
    days: d.days && typeof d.days === "object" ? { ...d.days } : {},
    goal: typeof d.goal === "number" && d.goal > 0 ? d.goal : DEFAULT_GOAL,
    freezes: Math.max(0, Math.min(MAX_FREEZE, typeof d.freezes === "number" ? d.freezes : 0)),
    frozen: Array.isArray(d.frozen) ? [...d.frozen] : [],
    rewarded: typeof d.rewarded === "number" ? d.rewarded : 0,
    spent: typeof d.spent === "number" && d.spent >= 0 ? d.spent : 0,
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
  let total = 0;
  for (const k in d.days) total += d.days[k];
  const spendable = Math.max(0, total - (d.spent || 0));
  return {
    xp,
    goal: d.goal,
    pct: d.goal > 0 ? Math.min(1, xp / d.goal) : 0,
    streak: streakOf(d),
    freezes: d.freezes,
    goalMet: xp >= d.goal,
    spendable,
    freezeCost: FREEZE_COST,
    canRedeem: spendable >= FREEZE_COST && d.freezes < MAX_FREEZE,
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

// 用累积 XP 兑换 1 个断签保护：扣 spent（不动毛 totalXp → 不掉等级），freezes +1（封顶 MAX_FREEZE）。
export function redeemFreeze(): { ok: boolean; freezes: number; spendable: number } {
  const d = readRaw();
  let total = 0;
  for (const k in d.days) total += d.days[k];
  const spendable = Math.max(0, total - (d.spent || 0));
  if (spendable >= FREEZE_COST && d.freezes < MAX_FREEZE) {
    d.spent = (d.spent || 0) + FREEZE_COST;
    d.freezes += 1;
    reconcile(d);
    persist(d);
    return { ok: true, freezes: d.freezes, spendable: spendable - FREEZE_COST };
  }
  return { ok: false, freezes: d.freezes, spendable };
}

// ---- 等级 / 段位 / 统计（④⑤ 本地真实算）----
export const LEVEL_BASE = 60; // 第 L→L+1 级所需 XP = LEVEL_BASE*L（累计为三角数，前期快后期缓）
export const TIER_MIN_LEVEL = [1, 3, 6, 10, 15, 21]; // 见习 / 青铜 / 白银 / 黄金 / 铂金 / 钻石

function cumXpFor(level: number): number {
  return (LEVEL_BASE * (level - 1) * level) / 2; // 达到 level 所需累计 XP
}

export interface LevelInfo {
  level: number;
  into: number; // 当前级已积累
  span: number; // 当前级总跨度
  toNext: number; // 距下一级
  pct: number; // 0..1
  total: number;
  tier: number; // 段位索引 0..TIER_MIN_LEVEL.length-1
}

export function levelInfo(total: number): LevelInfo {
  let level = 1;
  while (cumXpFor(level + 1) <= total) level++;
  const base = cumXpFor(level);
  const span = cumXpFor(level + 1) - base;
  const into = total - base;
  let tier = 0;
  for (let k = 0; k < TIER_MIN_LEVEL.length; k++) if (level >= TIER_MIN_LEVEL[k]) tier = k;
  return { level, into, span, toNext: span - into, pct: span > 0 ? into / span : 0, total, tier };
}

// 累计赚取的 XP（每日流水求和，绑真实学习）。
export function totalXp(): number {
  const d = load();
  let s = 0;
  for (const k in d.days) s += d.days[k];
  return s;
}

// 单日最高 XP。
export function bestDayXp(): number {
  const d = load();
  let m = 0;
  for (const k in d.days) if (d.days[k] > m) m = d.days[k];
  return m;
}

// 历史最长连胜（扫所有 covered 日，求最长连续 run）。
export function maxStreak(): number {
  const d = load();
  const set = new Set<string>();
  for (const k in d.days) if (d.days[k] >= d.goal) set.add(k);
  for (const f of d.frozen) set.add(f);
  let best = 0;
  for (const day of set) {
    if (set.has(shift(day, -1))) continue; // 只从 run 起点数
    let len = 0;
    let cur = day;
    while (set.has(cur)) {
      len++;
      cur = shift(cur, 1);
    }
    if (len > best) best = len;
  }
  return best;
}

// 某个自然月的格子（1..月末），供月历翻页渲染。monthIndex: 0=一月 .. 11=十二月。
export function monthGrid(year: number, monthIndex: number): DayCell[] {
  const d = load();
  const t = today();
  const count = new Date(year, monthIndex + 1, 0).getDate();
  const cells: DayCell[] = [];
  for (let day = 1; day <= count; day++) {
    const dt = new Date(year, monthIndex, day);
    const date = fmt(dt);
    const xp = d.days[date] ?? 0;
    const isMet = xp >= d.goal;
    cells.push({
      date,
      day,
      xp,
      met: isMet,
      partial: !isMet && xp > 0,
      frozen: d.frozen.includes(date),
      today: date === t,
      future: date > t,
      weekday: dt.getDay(),
    });
  }
  return cells;
}
