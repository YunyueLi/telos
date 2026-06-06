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

const STORAGE_KEY = "telos:learner:v1";

// Default (pre-diagnosis) state — Python/类型/HTTP 已掌握，REST 学习中。
export function defaultState(): LearnerState {
  const s = emptyState();
  for (const id of ["py", "types", "http"]) {
    s.mastery[id] = 0.9;
    s.cards[id] = review(newCard(), GOOD, 0);
  }
  s.mastery["rest"] = 0.62;
  s.version = 1;
  return s;
}

export function load(): LearnerState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LearnerState) : null;
  } catch {
    return null;
  }
}

export function save(state: LearnerState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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

export function subLabel(g: KnowledgeGraph, state: LearnerState, id: string): string {
  const st = statusOf(g, state, id);
  const pct = Math.round((state.mastery[id] ?? 0) * 100);
  const goal = g.get(id).isGoal;
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
}

export function buildView(g: KnowledgeGraph, state: LearnerState): LearnerView {
  const ids = g.ids();
  const visual: Record<string, "done" | "now" | "learn" | "lock"> = {};
  const sub: Record<string, string> = {};
  for (const id of ids) {
    visual[id] = visualClass(statusOf(g, state, id));
    sub[id] = subLabel(g, state, id);
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
  };
}

export interface LearnerApi extends LearnerView {
  graph: KnowledgeGraph;
  record: (id: string, correct: boolean, grade?: number) => void;
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

  const reset = useCallback(() => {
    const s = defaultState();
    save(s);
    setState(s);
  }, []);

  const view = useMemo(() => buildView(SEED_GRAPH, state), [state]);
  return { ...view, graph: SEED_GRAPH, record, applyDiagnosis, reset };
}
