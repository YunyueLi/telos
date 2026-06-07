// 学习项目库的单一真相源：可同时持有多个学习项目，跨所有页面共享当前项目 + 列表。
// Provider 挂在 layout，切路由保持挂载。所有写操作落盘 telos:projects 并刷新连胜。
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
import { useT } from "./i18n";
import {
  type Project,
  deleteProject as delProject,
  genId,
  getActiveId,
  listProjects,
  setActiveId,
  upsertProject,
} from "./project";
import { deriveGraph } from "./derive";
import { computeXp, getStreak, touchStreak } from "./xp";

interface ProjectContextValue {
  ready: boolean;
  projects: Project[]; // 全部学习项目（按最近更新排序）
  project: Project | null; // 当前项目
  graph: KnowledgeGraph | null;
  view: LearnerView | null;
  xp: number;
  streak: number;
  composing: boolean; // 正在"新学习"（即使有旧项目也显示引导页）
  deriving: boolean;
  deriveError: string | null;
  derive: (goal: string) => Promise<boolean>;
  record: (id: string, correct: boolean, grade?: number) => void;
  reviewCard: (id: string, grade: number) => void;
  applyState: (state: LearnerState) => void;
  switchProject: (id: string) => void;
  startNew: () => void;
  cancelNew: () => void;
  removeProject: (id: string) => void;
}

const Ctx = createContext<ProjectContextValue | null>(null);

const byRecent = (a: Project, b: Project) => (b.updatedAt || 0) - (a.updatedAt || 0);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  const [ready, setReady] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActive] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [streak, setStreak] = useState(0);
  const [deriving, setDeriving] = useState(false);
  const [deriveError, setDeriveError] = useState<string | null>(null);

  useEffect(() => {
    setProjects(listProjects());
    setActive(getActiveId());
    setStreak(getStreak());
    setReady(true);
  }, []);

  const project = useMemo(
    () => projects.find((p) => p.id === activeId) ?? null,
    [projects, activeId],
  );
  const graph = useMemo(
    () => (project ? new KnowledgeGraph(project.points) : null),
    [project],
  );
  const view = useMemo(
    () => (graph && project ? buildView(graph, project.state, t) : null),
    [graph, project, t],
  );
  const xp = useMemo(
    () => (graph && project ? computeXp(graph, project.state) : 0),
    [graph, project],
  );

  // 把更新后的项目并入列表（去重 + 按最近排序）
  const merge = useCallback((p: Project) => {
    setProjects((prev) => [p, ...prev.filter((x) => x.id !== p.id)].sort(byRecent));
  }, []);

  const derive = useCallback(
    async (goal: string): Promise<boolean> => {
      const g = goal.trim();
      if (!g) return false;
      setDeriving(true);
      setDeriveError(null);
      try {
        const res = await deriveGraph(g);
        const now = Date.now();
        const p: Project = {
          id: genId(),
          goal: res.goal,
          title: res.title,
          points: res.points,
          state: emptyState(),
          createdAt: now,
          updatedAt: now,
        };
        upsertProject(p);
        setActiveId(p.id);
        merge(p);
        setActive(p.id);
        setComposing(false);
        setStreak(touchStreak());
        setDeriving(false);
        return true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : t("err.deriveFailedShort");
        setDeriveError(msg === "NO_ENDPOINT" ? t("err.noEndpointDerive") : msg);
        setDeriving(false);
        return false;
      }
    },
    [merge, t],
  );

  const mutateActive = useCallback(
    (fn: (g: KnowledgeGraph, state: LearnerState) => void) => {
      setProjects((prev) => {
        const cur = prev.find((p) => p.id === activeId);
        if (!cur) return prev;
        const g = new KnowledgeGraph(cur.points);
        const state: LearnerState = JSON.parse(JSON.stringify(cur.state));
        fn(g, state);
        const p: Project = { ...cur, state, updatedAt: Date.now() };
        upsertProject(p);
        return [p, ...prev.filter((x) => x.id !== cur.id)].sort(byRecent);
      });
      setStreak(touchStreak());
    },
    [activeId],
  );

  const record = useCallback(
    (id: string, correct: boolean, grade: number = GOOD) => {
      mutateActive((g, state) => engineRecord(g, state, id, correct, grade));
    },
    [mutateActive],
  );

  const reviewCard = useCallback(
    (id: string, grade: number) => {
      mutateActive((_g, state) => {
        const c = state.cards[id] ?? newCard();
        state.cards[id] = review(c, grade, state.day);
        state.version += 1;
      });
    },
    [mutateActive],
  );

  const applyState = useCallback(
    (next: LearnerState) => {
      mutateActive((_g, state) => {
        state.mastery = next.mastery;
        state.cards = next.cards;
        state.day = next.day;
        state.version = (state.version || 0) + 1;
      });
    },
    [mutateActive],
  );

  const switchProject = useCallback((id: string) => {
    setActiveId(id);
    setActive(id);
    setComposing(false);
  }, []);

  const startNew = useCallback(() => {
    setComposing(true);
    setDeriveError(null);
  }, []);

  const cancelNew = useCallback(() => setComposing(false), []);

  const removeProject = useCallback((id: string) => {
    delProject(id);
    setProjects(listProjects());
    setActive(getActiveId());
  }, []);

  const value: ProjectContextValue = {
    ready,
    projects,
    project,
    graph,
    view,
    xp,
    streak,
    composing,
    deriving,
    deriveError,
    derive,
    record,
    reviewCard,
    applyState,
    switchProject,
    startNew,
    cancelNew,
    removeProject,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProject(): ProjectContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useProject 必须在 ProjectProvider 内使用");
  return v;
}
