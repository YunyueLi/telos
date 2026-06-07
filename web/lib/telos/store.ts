// Client-side learner state: localStorage persistence + a derived view + a React hook.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  GOOD,
  KnowledgeGraph,
  LearnerState,
  SEED_GRAPH,
  Status,
  diagnose,
  dueReviews,
  emptyState,
  learningFrontier,
  newCard,
  recordResult,
  review,
  statusOf,
} from "./engine";
import { currentStateKey } from "./account";

// Default (pre-diagnosis) state — Python/类型/HTTP 已掌握，REST 学习中。
export function defaultState(): LearnerState {
  const s = emptyState();
  for (const id of ["py", "types", "http"]) {
    s.mastery[id] = 0.9;
    s.cards[id] = review(newCard(), GOOD, 0);
  }
  s.mastery["rest"] = 0.62;
  s.day = 5; // 几天后——已掌握的点进入「待复习」
  s.version = 1;
  return s;
}

export function load(): LearnerState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(currentStateKey());
    return raw ? (JSON.parse(raw) as LearnerState) : null;
  } catch {
    return null;
  }
}

export function save(state: LearnerState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(currentStateKey(), JSON.stringify(state));
  } catch {
    /* ignore quota/availability errors */
  }
}

// Map engine status -> the map/profile visual class.
export function visualClass(s: Status): "done" | "now" | "learn" | "lock" {
  if (s === "mastered") return "done";
  if (s === "learning") return "learn";
  if (s === "learnable") return "now";
  return "lock";
}

type Translator = (key: string, vars?: Record<string, string | number>) => string;

// t?：可选 i18n 翻译器；不传则回退内置中文（向后兼容）。
export function subLabel(g: KnowledgeGraph, state: LearnerState, id: string, t?: Translator): string {
  const st = statusOf(g, state, id);
  const pct = Math.round((state.mastery[id] ?? 0) * 100);
  const goal = g.get(id).isGoal;
  if (t) {
    if (st === "mastered") return t("status.mastered");
    if (st === "learning") return t("status.learning", { pct });
    if (st === "learnable") return goal ? t("status.sprint") : t("status.now");
    return goal ? t("status.goal") : t("status.locked");
  }
  if (st === "mastered") return "已掌握";
  if (st === "learning") return `学习中 ${pct}%`;
  if (st === "learnable") return goal ? "可冲刺" : "现在学这个";
  return goal ? "目标" : "未解锁";
}

export interface LearnerView {
  state: LearnerState;
  mastered: number;
  total: number;
  pct: number;
  etaDays: number;
  goalsReached: boolean;
  visual: Record<string, "done" | "now" | "learn" | "lock">;
  sub: Record<string, string>;
  next: { id: string; name: string; minutes: number } | null;
  frontier: { id: string; name: string; minutes: number }[];
  due: { id: string; name: string; r: number }[];
  modules: { id: string; title: string; total: number; mastered: number; firstId: string }[];
}

export function buildView(g: KnowledgeGraph, state: LearnerState, t?: Translator): LearnerView {
  const ids = g.ids();
  const visual: Record<string, "done" | "now" | "learn" | "lock"> = {};
  const sub: Record<string, string> = {};
  for (const id of ids) {
    visual[id] = visualClass(statusOf(g, state, id));
    sub[id] = subLabel(g, state, id, t);
  }
  const mastered = ids.filter((id) => (state.mastery[id] ?? 0) >= 0.8).length;
  const total = ids.length;
  const frontier = learningFrontier(g, state).map(([id]) => ({
    id,
    name: g.get(id).name,
    minutes: g.get(id).minutes ?? 25,
  }));
  const due = dueReviews(g, state).map(([id, r]) => ({ id, name: g.get(id).name, r }));
  const remaining = total - mastered;
  // 模块/阶段汇总（按首次出现顺序——倒推已按阶段排好），用于地图侧栏「阶段概览」展示成体系结构。
  const modOrder: string[] = [];
  const modSeen = new Set<string>();
  for (const id of ids) {
    const m = g.get(id).module;
    if (m && !modSeen.has(m)) {
      modSeen.add(m);
      modOrder.push(m);
    }
  }
  const modules = modOrder.map((mid) => {
    const members = ids.filter((id) => g.get(id).module === mid);
    return {
      id: mid,
      title: g.get(members[0]).moduleTitle || mid,
      total: members.length,
      mastered: members.filter((id) => (state.mastery[id] ?? 0) >= 0.8).length,
      firstId: members[0],
    };
  });
  return {
    state,
    mastered,
    total,
    pct: Math.round((mastered / total) * 100),
    etaDays: Math.max(1, Math.round(remaining * 1.5)),
    goalsReached: g.goals().every((id) => (state.mastery[id] ?? 0) >= 0.8),
    visual,
    sub,
    next: frontier[0] ?? null,
    frontier,
    due,
    modules,
  };
}

export interface LearnerApi extends LearnerView {
  graph: KnowledgeGraph;
  record: (id: string, correct: boolean, grade?: number) => void;
  reviewCard: (id: string, grade: number) => void;
  applyDiagnosis: (answers: Record<string, boolean>) => void;
  reset: () => void;
}

export function useLearner(): LearnerApi {
  // Deterministic initial state for SSR/export; hydrate from localStorage after mount.
  const [state, setState] = useState<LearnerState>(() => defaultState());

  useEffect(() => {
    const saved = load();
    if (saved) setState(saved);
  }, []);

  const record = useCallback((id: string, correct: boolean, grade: number = GOOD) => {
    setState((prev) => {
      const next: LearnerState = JSON.parse(JSON.stringify(prev));
      recordResult(SEED_GRAPH, next, id, correct, grade);
      save(next);
      return next;
    });
  }, []);

  const applyDiagnosis = useCallback((answers: Record<string, boolean>) => {
    const next = diagnose(SEED_GRAPH, (id) => answers[id] ?? false);
    save(next);
    setState(next);
  }, []);

  const reviewCard = useCallback((id: string, grade: number) => {
    setState((prev) => {
      const next: LearnerState = JSON.parse(JSON.stringify(prev));
      const c = next.cards[id] ?? newCard();
      next.cards[id] = review(c, grade, next.day); // 纯 FSRS 重排，不动掌握度
      next.version += 1;
      save(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    const s = defaultState();
    save(s);
    setState(s);
  }, []);

  const view = useMemo(() => buildView(SEED_GRAPH, state), [state]);
  return { ...view, graph: SEED_GRAPH, record, reviewCard, applyDiagnosis, reset };
}
