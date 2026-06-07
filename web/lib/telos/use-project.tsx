// 倒推「活动项目」的单一真相源：跨所有产品页面共享同一份图谱 + 学习状态。
// Provider 挂在 layout，App Router 切路由时保持挂载，状态不丢。
// 所有写操作都会落盘 telos:project 并刷新连胜，供复习页 / XP / 云同步读取。
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  GOOD,
  KnowledgeGraph,
  type LearnerState,
  emptyState,
  newCard,
  recordResult as engineRecord,
  review,
} from "./engine";
import { buildView, type LearnerView } from "./store";
import { type Project, clearProject, loadProject, saveProject } from "./project";
import { deriveGraph } from "./derive";
import { computeXp, getStreak, touchStreak } from "./xp";

interface ProjectContextValue {
  ready: boolean; // 已尝试从 localStorage 恢复（用于避免静态导出闪烁）
  project: Project | null;
  graph: KnowledgeGraph | null;
  view: LearnerView | null;
  xp: number;
  streak: number;
  deriving: boolean;
  deriveError: string | null;
  derive: (goal: string) => Promise<boolean>;
  record: (id: string, correct: boolean, grade?: number) => void;
  reviewCard: (id: string, grade: number) => void;
  applyState: (state: LearnerState) => void;
  reset: () => void;
}

const Ctx = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [streak, setStreak] = useState(0);
  const [deriving, setDeriving] = useState(false);
  const [deriveError, setDeriveError] = useState<string | null>(null);

  useEffect(() => {
    setProject(loadProject());
    setStreak(getStreak());
    setReady(true);
  }, []);

  const graph = useMemo(
    () => (project ? new KnowledgeGraph(project.points) : null),
    [project],
  );
  const view = useMemo(
    () => (graph && project ? buildView(graph, project.state) : null),
    [graph, project],
  );
  const xp = useMemo(
    () => (graph && project ? computeXp(graph, project.state) : 0),
    [graph, project],
  );

  // 落盘 + 记一次「今天有学习活动」，并把 setState 一并完成。
  const commit = useCallback((p: Project, touch = true) => {
    saveProject(p);
    setProject(p);
    if (touch) setStreak(touchStreak());
  }, []);

  const derive = useCallback(
    async (goal: string): Promise<boolean> => {
      const g = goal.trim();
      if (!g) return false;
      setDeriving(true);
      setDeriveError(null);
      try {
        const res = await deriveGraph(g);
        commit({
          goal: res.goal,
          points: res.points,
          state: emptyState(),
          updatedAt: Date.now(),
        });
        setDeriving(false);
        return true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "倒推失败";
        setDeriveError(
          msg === "NO_ENDPOINT"
            ? "还没配置倒推服务 —— 到「我 · 设置」里填本地或线上端点即可。"
            : msg,
        );
        setDeriving(false);
        return false;
      }
    },
    [commit],
  );

  const record = useCallback(
    (id: string, correct: boolean, grade: number = GOOD) => {
      setProject((prev) => {
        if (!prev) return prev;
        const g = new KnowledgeGraph(prev.points);
        const state: LearnerState = JSON.parse(JSON.stringify(prev.state));
        engineRecord(g, state, id, correct, grade);
        const p: Project = { ...prev, state, updatedAt: Date.now() };
        saveProject(p);
        return p;
      });
      setStreak(touchStreak());
    },
    [],
  );

  const reviewCard = useCallback((id: string, grade: number) => {
    setProject((prev) => {
      if (!prev) return prev;
      const state: LearnerState = JSON.parse(JSON.stringify(prev.state));
      const c = state.cards[id] ?? newCard();
      state.cards[id] = review(c, grade, state.day); // 纯 FSRS 重排，不动掌握度
      state.version += 1;
      const p: Project = { ...prev, state, updatedAt: Date.now() };
      saveProject(p);
      return p;
    });
    setStreak(touchStreak());
  }, []);

  const applyState = useCallback((state: LearnerState) => {
    setProject((prev) => {
      if (!prev) return prev;
      const p: Project = { ...prev, state, updatedAt: Date.now() };
      saveProject(p);
      return p;
    });
    setStreak(touchStreak());
  }, []);

  const reset = useCallback(() => {
    clearProject();
    setProject(null);
    setDeriveError(null);
  }, []);

  const value: ProjectContextValue = {
    ready,
    project,
    graph,
    view,
    xp,
    streak,
    deriving,
    deriveError,
    derive,
    record,
    reviewCard,
    applyState,
    reset,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProject(): ProjectContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useProject 必须在 ProjectProvider 内使用");
  return v;
}
