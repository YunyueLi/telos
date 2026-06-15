"use client";

// 图谱准确性 · T4 经验闭环埋点（护城河）。
// 记录「在某目标图谱里，学习者首次接触某节点时——其【前置掌握快照】+【首答对错】」。
// 用途：累积后反验前置边是否成立——掌握了前置 P 的人，对节点 N 的首答正确率
//   · 显著高于瞎猜 → 边 P→N 成立、教对了；
//   · ≈ 瞎猜（1/选项数）→ 边可疑（P 其实不是 N 的真前置，或图谱推错）。
// 这是 Telos 唯一无法被模型"自审"替代的护城河信号（经验=金标准，见 docs/HANDOFF.md §7 验证路线 T4）。
//
// 设计红线：纯【旁路累积】——不打扰教学流、不影响 XP/掌握度/连胜、不阻塞任何交互。
// 现仅落本地（telos:edge-evidence）让数据从现在开始攒；跨设备/多学习者聚合是后续（可挂 sync-state 或独立表）。
// 「首答」语义：同一 (goal,node,phase) 只记第一条——重复学习/二刷不覆盖首次接触的真实信号。

export interface PrereqSnapshot {
  id: string;
  mastered: boolean; // 首答那一刻该前置是否已掌握（view.visual==="done"）
}

export interface FirstAttempt {
  goal: string; // 项目目标 = 图谱分组键
  node: string; // 节点 id
  nodeName: string;
  phase: "predict" | "challenge"; // predict=微课教学前首猜；challenge=OLM「我其实会」自评
  correct: boolean;
  options: number; // 选项数（算瞎猜基线 1/options 用）
  prereqs: PrereqSnapshot[];
  ts: number;
}

const KEY = "telos:edge-evidence";
const CAP = 2000; // 上限，超出丢最旧（旁路数据，不必无限留）

function read(): FirstAttempt[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const a = JSON.parse(raw) as FirstAttempt[];
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

function write(a: FirstAttempt[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(a.length > CAP ? a.slice(a.length - CAP) : a));
  } catch {
    /* 旁路埋点：写失败静默，绝不影响学习流 */
  }
}

// 记一次首答。同一 (goal,node,phase) 已有则跳过（只留真正的"首次接触"）。永不抛错。
export function recordFirstAttempt(a: Omit<FirstAttempt, "ts"> & { ts?: number }): void {
  if (typeof window === "undefined") return;
  try {
    if (!a.goal || !a.node) return;
    const all = read();
    if (all.some((x) => x.node === a.node && x.goal === a.goal && x.phase === a.phase)) return;
    all.push({
      goal: a.goal,
      node: a.node,
      nodeName: a.nodeName,
      phase: a.phase,
      correct: !!a.correct,
      options: a.options || 0,
      prereqs: Array.isArray(a.prereqs) ? a.prereqs.map((p) => ({ id: p.id, mastered: !!p.mastered })) : [],
      ts: a.ts ?? Date.now(),
    });
    write(all);
  } catch {
    /* 静默 */
  }
}

export function getEvidence(): FirstAttempt[] {
  return read();
}

export function clearEvidence(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

// 调试/导出：按【前置边】聚合首答正确率——掌握了该前置时，下游节点首答对的比例。
// 返回 { edgeKey: "prereqId→nodeId", n, correctRate, baseline } 供日后 T4 分析视图/导出用。
export interface EdgeStat {
  prereq: string;
  node: string;
  nodeName: string;
  n: number; // 样本数（掌握该前置 + 对该节点有首答）
  correct: number;
  rate: number; // 首答正确率
  baselineAvg: number; // 平均瞎猜基线（1/选项数）
}

export function edgeStats(rows: FirstAttempt[] = read()): EdgeStat[] {
  const agg = new Map<string, { node: string; nodeName: string; prereq: string; n: number; correct: number; base: number }>();
  for (const r of rows) {
    for (const p of r.prereqs) {
      if (!p.mastered) continue; // 只看「前置已掌握」的样本
      const k = `${p.id}→${r.node}`;
      const e = agg.get(k) ?? { node: r.node, nodeName: r.nodeName, prereq: p.id, n: 0, correct: 0, base: 0 };
      e.n += 1;
      if (r.correct) e.correct += 1;
      e.base += r.options > 1 ? 1 / r.options : 0;
      agg.set(k, e);
    }
  }
  return [...agg.values()].map((e) => ({
    prereq: e.prereq,
    node: e.node,
    nodeName: e.nodeName,
    n: e.n,
    correct: e.correct,
    rate: e.n ? e.correct / e.n : 0,
    baselineAvg: e.n ? e.base / e.n : 0,
  }));
}
