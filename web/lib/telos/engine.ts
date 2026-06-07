// Telos learning engine — TypeScript port of telos-core (Python), for client-side use.
// Mirrors: models / fsrs / kst / fire / diagnosis / frontier / engine.
// Kept in sync with /core/telos_core. Zero dependencies.

// ============ models ============
export type Status = "locked" | "learnable" | "learning" | "mastered";

export type DomainClass = "A" | "B" | "C" | "D" | "E" | "F"; // 见 docs/STRATEGY.md §1

export interface KnowledgePoint {
  id: string;
  name: string;
  prereqs: string[];
  isGoal?: boolean;
  minutes?: number;
  domain?: DomainClass; // 学习机制大类，决定诊断/复习策略；缺省按 B（良构程序）
  desc?: string; // can-do：在什么条件下能做到什么（倒推时生成；可空）
  drill?: string; // 怎么刻意练习这一项
  benchmark?: string; // 量化/可观测的达标线
}

export interface Card {
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  lastReviewDay: number;
  state: "new" | "review";
}

export interface LearnerState {
  mastery: Record<string, number>; // id -> [0,1]
  cards: Record<string, Card>;
  day: number;
  version: number;
}

export function newCard(): Card {
  return { stability: 0, difficulty: 0, reps: 0, lapses: 0, lastReviewDay: 0, state: "new" };
}

export function emptyState(): LearnerState {
  return { mastery: {}, cards: {}, day: 0, version: 0 };
}

// The FastAPI / JWT seed graph — same 8 points as core/seed.py and the visual map.
export const SEED_POINTS: KnowledgePoint[] = [
  { id: "py", name: "Python 基础", prereqs: [], minutes: 30 },
  { id: "types", name: "函数与类型", prereqs: ["py"], minutes: 25 },
  { id: "http", name: "HTTP 基础", prereqs: ["py"], minutes: 25 },
  { id: "jwt", name: "JWT 原理", prereqs: ["http", "types"], minutes: 25 },
  { id: "rest", name: "REST 设计", prereqs: ["http"], minutes: 30 },
  { id: "route", name: "FastAPI 路由", prereqs: ["jwt"], minutes: 30 },
  { id: "mw", name: "鉴权中间件", prereqs: ["jwt", "rest"], minutes: 35 },
  { id: "deploy", name: "部署上线", prereqs: ["route", "mw"], isGoal: true, minutes: 40 },
];

export class KnowledgeGraph {
  points: Record<string, KnowledgePoint> = {};
  private deps: Record<string, Set<string>> = {};

  constructor(points: KnowledgePoint[]) {
    for (const p of points) {
      this.points[p.id] = p;
      this.deps[p.id] = this.deps[p.id] ?? new Set();
    }
    for (const p of points) {
      for (const pre of p.prereqs) {
        (this.deps[pre] = this.deps[pre] ?? new Set()).add(p.id);
      }
    }
  }
  ids(): string[] {
    return Object.keys(this.points);
  }
  get(id: string): KnowledgePoint {
    return this.points[id];
  }
  prerequisites(id: string): string[] {
    return this.points[id]?.prereqs ?? [];
  }
  dependents(id: string): string[] {
    return [...(this.deps[id] ?? [])];
  }
  ancestors(id: string): Set<string> {
    const seen = new Set<string>();
    const stack = [...this.prerequisites(id)];
    while (stack.length) {
      const x = stack.pop()!;
      if (seen.has(x)) continue;
      seen.add(x);
      stack.push(...this.prerequisites(x));
    }
    return seen;
  }
  descendants(id: string): Set<string> {
    const seen = new Set<string>();
    const stack = [...this.dependents(id)];
    while (stack.length) {
      const x = stack.pop()!;
      if (seen.has(x)) continue;
      seen.add(x);
      stack.push(...this.dependents(x));
    }
    return seen;
  }
  goals(): string[] {
    return this.ids().filter((id) => this.points[id].isGoal);
  }
}

export const SEED_GRAPH = new KnowledgeGraph(SEED_POINTS);

// ============ fsrs (FSRS-4.5) ============
export const DECAY = -0.5;
export const FACTOR = 19 / 81;
export const DEFAULT_W = [
  0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61,
];
export const AGAIN = 1, HARD = 2, GOOD = 3, EASY = 4;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export function retrievability(stability: number, elapsedDays: number): number {
  if (stability <= 0) return 0;
  return Math.pow(1 + (FACTOR * Math.max(0, elapsedDays)) / stability, DECAY);
}
export function interval(stability: number, requestRetention = 0.9): number {
  return (stability / FACTOR) * (Math.pow(requestRetention, 1 / DECAY) - 1);
}
const initStability = (w: number[], g: number) => Math.max(0.1, w[g - 1]);
const initDifficulty = (w: number[], g: number) => clamp(w[4] - w[5] * (g - 3), 1, 10);
function nextDifficulty(w: number[], d: number, g: number): number {
  const target = initDifficulty(w, EASY);
  let nd = d - w[6] * (g - 3);
  nd = w[7] * target + (1 - w[7]) * nd;
  return clamp(nd, 1, 10);
}
function stabilityAfterRecall(w: number[], d: number, s: number, r: number, g: number): number {
  const hard = g === HARD ? w[15] : 1;
  const easy = g === EASY ? w[16] : 1;
  return s * (1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp(w[10] * (1 - r)) - 1) * hard * easy);
}
function stabilityAfterLapse(w: number[], d: number, s: number, r: number): number {
  const sf = w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp(w[14] * (1 - r));
  return Math.min(sf, s);
}
export function review(card: Card, grade: number, day: number, w = DEFAULT_W): Card {
  const g = Math.trunc(grade);
  let s: number, d: number, lapses: number;
  if (card.reps === 0 || card.state === "new") {
    s = initStability(w, g);
    d = initDifficulty(w, g);
    lapses = g === AGAIN ? 1 : 0;
  } else {
    const elapsed = Math.max(0, day - card.lastReviewDay);
    const r = retrievability(card.stability, elapsed);
    d = nextDifficulty(w, card.difficulty, g);
    if (g === AGAIN) {
      s = stabilityAfterLapse(w, d, card.stability, r);
      lapses = card.lapses + 1;
    } else {
      s = stabilityAfterRecall(w, d, card.stability, r, g);
      lapses = card.lapses;
    }
  }
  return { stability: Math.max(0.1, s), difficulty: d, reps: card.reps + 1, lapses, lastReviewDay: day, state: "review" };
}

// ============ kst ============
export function masteredIds(state: LearnerState, threshold = 0.8): Set<string> {
  return new Set(Object.keys(state.mastery).filter((id) => state.mastery[id] >= threshold));
}
export function outerFringe(g: KnowledgeGraph, mastered: Set<string>): Set<string> {
  return new Set(
    g.ids().filter((id) => !mastered.has(id) && g.prerequisites(id).every((p) => mastered.has(p))),
  );
}
export function innerFringe(g: KnowledgeGraph, mastered: Set<string>): Set<string> {
  return new Set([...mastered].filter((id) => !g.dependents(id).some((d) => mastered.has(d))));
}
export function statusOf(
  g: KnowledgeGraph,
  state: LearnerState,
  id: string,
  threshold = 0.8,
  learningFloor = 0.15,
): Status {
  const m = state.mastery[id] ?? 0;
  if (m >= threshold) return "mastered";
  const mastered = masteredIds(state, threshold);
  const ready = g.prerequisites(id).every((p) => mastered.has(p));
  if (!ready) return "locked";
  return m >= learningFloor ? "learning" : "learnable";
}

// ============ fire (credit down / penalty up) ============
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export function applyEvidence(
  state: LearnerState,
  g: KnowledgeGraph,
  id: string,
  correct: boolean,
  strength = 0.85,
  decay = 0.5,
): void {
  const cur = state.mastery[id] ?? 0;
  if (correct) {
    state.mastery[id] = clamp01(cur + strength * (1 - cur));
    propagate(state, g, id, 1, strength, decay);
  } else {
    state.mastery[id] = clamp01(cur - strength * cur - 0.05);
    propagate(state, g, id, -1, strength, decay);
  }
  state.version += 1;
}
function propagate(
  state: LearnerState,
  g: KnowledgeGraph,
  id: string,
  sign: number,
  strength: number,
  decay: number,
): void {
  const start = sign > 0 ? g.prerequisites(id) : g.dependents(id);
  const seen = new Set<string>();
  const q: [string, number][] = start.map((x) => [x, 1]);
  while (q.length) {
    const [node, dist] = q.shift()!;
    if (seen.has(node)) continue;
    seen.add(node);
    const amt = strength * Math.pow(decay, dist);
    const cur = state.mastery[node] ?? 0;
    let next: string[];
    if (sign > 0) {
      state.mastery[node] = clamp01(cur + amt * (1 - cur));
      next = g.prerequisites(node);
    } else {
      state.mastery[node] = clamp01(cur - amt * cur);
      next = g.dependents(node);
    }
    for (const x of next) q.push([x, dist + 1]);
  }
}

// ============ bkt (Bayesian Knowledge Tracing) ============
export interface BktParams {
  pL0: number;
  pT: number;
  pS: number;
  pG: number;
}
export const BKT: BktParams = { pL0: 0.25, pT: 0.15, pS: 0.1, pG: 0.2 };

// 按学习机制大类预设的 BKT 参数（与 core/telos_core/bkt.py 的 DOMAIN_BKT 对齐）。
export const DOMAIN_BKT: Record<DomainClass, BktParams> = {
  A: { pL0: 0.2, pT: 0.2, pS: 0.08, pG: 0.25 },
  B: { pL0: 0.25, pT: 0.12, pS: 0.05, pG: 0.2 },
  C: { pL0: 0.3, pT: 0.1, pS: 0.15, pG: 0.2 },
  D: { pL0: 0.15, pT: 0.12, pS: 0.1, pG: 0.02 },
  E: { pL0: 0.2, pT: 0.1, pS: 0.15, pG: 0.05 },
  F: { pL0: 0.3, pT: 0.1, pS: 0.1, pG: 0.1 },
};
export const DOMAIN_LABEL: Record<DomainClass, string> = {
  A: "记忆",
  B: "程序",
  C: "创造",
  D: "动作",
  E: "对抗",
  F: "习惯",
};
export function domainLabel(domain?: string): string {
  const k = (domain ?? "B").toString().toUpperCase();
  return (DOMAIN_LABEL as Record<string, string>)[k] ?? "程序";
}
export function paramsFor(domain?: string): BktParams {
  const k = (domain ?? "").toString().toUpperCase();
  return (DOMAIN_BKT as Record<string, BktParams>)[k] ?? BKT;
}
const FSRS_DOMAINS = new Set(["A", "B", "C", "E"]);
export function usesFsrs(domain?: string): boolean {
  return FSRS_DOMAINS.has((domain ?? "B").toString().toUpperCase());
}

export function bktPosterior(p: number, correct: boolean, prm: BktParams = BKT): number {
  let num: number, den: number;
  if (correct) {
    num = p * (1 - prm.pS);
    den = num + (1 - p) * prm.pG;
  } else {
    num = p * prm.pS;
    den = num + (1 - p) * (1 - prm.pG);
  }
  return den > 0 ? num / den : p;
}
export function bktUpdate(p: number, correct: boolean, prm: BktParams = BKT): number {
  const post = bktPosterior(p, correct, prm);
  return post + (1 - post) * prm.pT;
}
export function bktPredict(p: number, prm: BktParams = BKT): number {
  return p * (1 - prm.pS) + (1 - p) * prm.pG;
}
export function binaryEntropy(p: number): number {
  if (p <= 0 || p >= 1) return 0;
  return -(p * Math.log2(p) + (1 - p) * Math.log2(1 - p));
}

// ============ diagnosis (BKT belief + information-gain selection) ============
export class Diagnosis {
  belief: Record<string, number> = {};
  asked = new Set<string>();
  answers: Record<string, boolean> = {};
  private prmOf: Record<string, BktParams> = {};
  constructor(public g: KnowledgeGraph, public budget = 25, params?: BktParams) {
    for (const id of g.ids()) {
      this.prmOf[id] = params ?? paramsFor(g.get(id).domain);
      this.belief[id] = this.prmOf[id].pL0;
    }
  }
  private infoGain(id: string): number {
    const prm = this.prmOf[id];
    const b = this.belief[id];
    const pc = bktPredict(b, prm);
    return (
      binaryEntropy(b) -
      (pc * binaryEntropy(bktPosterior(b, true, prm)) +
        (1 - pc) * binaryEntropy(bktPosterior(b, false, prm)))
    );
  }
  nextQuestion(): string | null {
    let best: string | null = null;
    let bestIg = -1;
    for (const id of this.g.ids()) {
      if (this.asked.has(id)) continue;
      const ig = this.infoGain(id);
      if (ig > bestIg) {
        best = id;
        bestIg = ig;
      }
    }
    if (best === null || this.asked.size >= this.budget || bestIg < 1e-3) return null;
    return best;
  }
  answer(id: string, correct: boolean): void {
    this.answerConf(id, correct, "high");
  }

  // CBM（信心加权）：用信心档调制 slip/guess —— 见 docs 研究。
  // 自信地答错 → slip→0，强力下拉信念（暴露误解）；没把握地答对 → guess 维持，弱上调（可能蒙对）。
  answerConf(id: string, correct: boolean, confidence: "low" | "mid" | "high"): void {
    this.asked.add(id);
    this.answers[id] = correct;
    const base = this.prmOf[id];
    const fG = confidence === "high" ? 0.2 : confidence === "mid" ? 0.6 : 1.3;
    const fS = confidence === "high" ? 0.2 : confidence === "mid" ? 0.6 : 1.6;
    const prm: BktParams = {
      ...base,
      pG: Math.min(0.9, base.pG * fG),
      pS: Math.min(0.9, base.pS * fS),
    };
    this.belief[id] = bktUpdate(this.belief[id], correct, prm);
    if (correct) {
      for (const a of this.g.ancestors(id))
        this.belief[a] = Math.max(this.belief[a], bktPosterior(this.belief[a], true, this.prmOf[a]));
    } else {
      for (const d of this.g.descendants(id))
        this.belief[d] = Math.min(this.belief[d], bktPosterior(this.belief[d], false, this.prmOf[d]));
    }
  }
  isDone(): boolean {
    return this.nextQuestion() === null;
  }
}

// ============ frontier ============
export function learningFrontier(g: KnowledgeGraph, state: LearnerState, threshold = 0.8): [string, number][] {
  const mastered = masteredIds(state, threshold);
  const goals = new Set(g.goals());
  const scored: [string, number][] = [];
  for (const id of outerFringe(g, mastered)) {
    const desc = g.descendants(id);
    const unlocking = desc.size;
    const towardGoal = g.get(id).isGoal || [...desc].some((d) => goals.has(d)) ? 1 : 0;
    scored.push([id, unlocking + towardGoal]);
  }
  scored.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return scored;
}
export function dueReviews(
  g: KnowledgeGraph,
  state: LearnerState,
  threshold = 0.8,
  requestRetention = 0.9,
): [string, number][] {
  const due: [string, number][] = [];
  for (const id of masteredIds(state, threshold)) {
    const card = state.cards[id];
    if (!card) continue;
    const elapsed = Math.max(0, state.day - card.lastReviewDay);
    const r = retrievability(card.stability, elapsed);
    if (r < requestRetention) due.push([id, r]);
  }
  due.sort((a, b) => a[1] - b[1]);
  return due;
}

// ============ engine ============
export function diagnose(
  g: KnowledgeGraph,
  oracle: (id: string) => boolean,
  budget = 25,
  knownThreshold = 0.6,
): LearnerState {
  const d = new Diagnosis(g, budget);
  for (;;) {
    const q = d.nextQuestion();
    if (q === null) break;
    d.answer(q, oracle(q));
  }
  const state = emptyState();
  // crisp KST knowledge state: a point judged known enters as mastered
  for (const id of g.ids()) state.mastery[id] = d.belief[id] >= knownThreshold ? 0.9 : d.belief[id];
  for (const id of g.ids())
    if (d.belief[id] >= knownThreshold && usesFsrs(g.get(id).domain))
      state.cards[id] = review(newCard(), GOOD, 0); // 动作/习惯类不走遗忘曲线
  state.version += 1;
  return state;
}
export function recordResult(
  g: KnowledgeGraph,
  state: LearnerState,
  id: string,
  correct: boolean,
  grade: number = GOOD,
): LearnerState {
  applyEvidence(state, g, id, correct);
  if (usesFsrs(g.get(id).domain)) {
    // 动作/习惯类不走遗忘曲线
    const card = state.cards[id] ?? newCard();
    state.cards[id] = review(card, correct ? grade : AGAIN, state.day);
  }
  return state;
}
export function progress(g: KnowledgeGraph, state: LearnerState, threshold = 0.8) {
  const mastered = masteredIds(state, threshold);
  return {
    mastered: mastered.size,
    total: g.ids().length,
    frontier: learningFrontier(g, state, threshold).map(([id]) => id),
    due: dueReviews(g, state, threshold).map(([id]) => id),
    goalsReached: g.goals().every((id) => (state.mastery[id] ?? 0) >= threshold),
  };
}
