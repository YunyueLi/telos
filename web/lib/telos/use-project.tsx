// 学习项目库的单一真相源：可同时持有多个学习项目，跨所有页面共享当前项目 + 列表。
// Provider 挂在 layout，切路由保持挂载。所有写操作落盘 telos:projects 并刷新连胜。
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
import { deriveGraph, generateTitle } from "./derive";
import {
  addDailyXp,
  computeXp,
  getDailyInfo,
  noteDerive,
  recentDays,
  setDailyGoal,
  type DailyInfo,
  type DayCell,
} from "./xp";
import { useAuth } from "./auth";
import { cloudConfigured } from "./supabase";
import { deleteRemoteProject, pullProjects, pushProject } from "./cloud";

interface ProjectContextValue {
  ready: boolean;
  projects: Project[]; // 全部学习项目（按最近更新排序）
  project: Project | null; // 当前项目
  graph: KnowledgeGraph | null;
  view: LearnerView | null;
  xp: number;
  streak: number;
  dailyXp: number; // 今日已得 XP
  dailyGoal: number; // 今日目标 XP
  dailyPct: number; // 今日进度 0..1
  dailyGoalMet: boolean;
  freezes: number; // 可用断签保护
  calendar: DayCell[]; // 最近若干天打卡格子
  goalNonce: number; // 每次"刚达成今日目标"自增 → 触发庆祝
  setDailyGoal: (g: number) => void;
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
  cloudOn: boolean;
  syncing: boolean;
  lastSync: number | null;
  syncNow: () => Promise<void>;
}

const Ctx = createContext<ProjectContextValue | null>(null);

const byRecent = (a: Project, b: Project) => (b.updatedAt || 0) - (a.updatedAt || 0);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  const [ready, setReady] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActive] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [dailyVersion, setDailyVersion] = useState(0); // 每次学习/改目标自增 → 重算每日信息
  const [goalNonce, setGoalNonce] = useState(0); // 刚达成今日目标 → 触发庆祝
  const [deriving, setDeriving] = useState(false);
  const projectsRef = useRef<Project[]>([]); // 与 projects 同步，供 mutateActive 同步读取算 XP delta
  const [deriveError, setDeriveError] = useState<string | null>(null);
  const { user } = useAuth();
  const userIdRef = useRef<string | null>(null);
  const syncedRef = useRef<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const cloudOn = cloudConfigured() && !!user;

  useEffect(() => {
    setProjects(listProjects());
    setActive(getActiveId());
    setReady(true);
  }, []);

  // projectsRef 跟随 projects（任何 setProjects 后同步），供 mutateActive 同步算 XP delta。
  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  // 给旧项目补「概括标题」：加载后对没有 title 的项目逐个联网概括并存回（一次性、节流、失败回退原目标）。
  const backfilledRef = useRef(false);
  useEffect(() => {
    if (!ready || backfilledRef.current) return;
    const need = projects.filter((p) => !(p.title && p.title.trim()));
    if (!need.length) return;
    backfilledRef.current = true;
    (async () => {
      for (const p of need) {
        const title = await generateTitle(p.goal);
        if (!title) continue;
        upsertProject({ ...p, title });
        setProjects((prev) => prev.map((x) => (x.id === p.id ? { ...x, title } : x)));
      }
    })();
  }, [ready, projects]);

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

  // 每日目标 / 连胜 / 断签保护：从 localStorage(telos:daily) 读，随每次学习/改目标重算。
  const daily = useMemo<DailyInfo | null>(
    () => (ready ? getDailyInfo() : null),
    [ready, dailyVersion],
  );
  const calendar = useMemo<DayCell[]>(
    () => (ready ? recentDays(35) : []),
    [ready, dailyVersion],
  );
  const streak = daily?.streak ?? 0;

  // 记一次真实学习获得的 XP（delta）：刷新每日信息；刚达标则触发庆祝。
  const noteLearning = useCallback((delta: number) => {
    const r = addDailyXp(delta);
    setDailyVersion((v) => v + 1);
    if (r.justMetGoal) setGoalNonce((n) => n + 1);
  }, []);

  const updateDailyGoal = useCallback((g: number) => {
    setDailyGoal(g);
    setDailyVersion((v) => v + 1);
  }, []);

  // 把更新后的项目并入列表（去重 + 按最近排序）
  const merge = useCallback((p: Project) => {
    setProjects((prev) => [p, ...prev.filter((x) => x.id !== p.id)].sort(byRecent));
  }, []);

  // 云端推送（已配置且已登录时）——即发即忘，失败不打断本地。
  const pushCloud = useCallback((p: Project) => {
    if (cloudConfigured() && userIdRef.current) pushProject(p).catch(() => {});
  }, []);

  // 拉取远端 + 按 updatedAt 合并（per-project 最后写入者胜）+ 回推本地更新者。
  const syncNow = useCallback(async () => {
    if (!cloudConfigured() || !userIdRef.current) return;
    setSyncing(true);
    try {
      const remote = await pullProjects();
      const m = new Map<string, Project>();
      for (const p of [...remote, ...listProjects()]) {
        const ex = m.get(p.id);
        if (!ex || (p.updatedAt || 0) > (ex.updatedAt || 0)) m.set(p.id, p);
      }
      const merged = [...m.values()].sort(byRecent);
      for (const p of merged) upsertProject(p);
      setProjects(merged);
      if (!getActiveId() && merged[0]) {
        setActiveId(merged[0].id);
        setActive(merged[0].id);
      }
      for (const p of merged) {
        const r = remote.find((x) => x.id === p.id);
        if (!r || (p.updatedAt || 0) > (r.updatedAt || 0)) await pushProject(p);
      }
      setLastSync(Date.now());
    } finally {
      setSyncing(false);
    }
  }, []);

  // 登录后自动同步一次（按 user.id 去重，token 刷新不重复触发）。
  useEffect(() => {
    userIdRef.current = user?.id ?? null;
    if (!cloudConfigured() || !user) {
      syncedRef.current = null;
      return;
    }
    if (syncedRef.current === user.id) return;
    syncedRef.current = user.id;
    void syncNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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
        pushCloud(p);
        setActive(p.id);
        setComposing(false);
        const r = noteDerive();
        setDailyVersion((v) => v + 1);
        if (r.justMetGoal) setGoalNonce((n) => n + 1);
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
      const cur = projectsRef.current.find((p) => p.id === activeId);
      if (!cur) return;
      const g = new KnowledgeGraph(cur.points);
      const before = computeXp(g, cur.state);
      const state: LearnerState = JSON.parse(JSON.stringify(cur.state));
      fn(g, state);
      const after = computeXp(g, state);
      const p: Project = { ...cur, state, updatedAt: Date.now() };
      upsertProject(p);
      pushCloud(p);
      const next = [p, ...projectsRef.current.filter((x) => x.id !== cur.id)].sort(byRecent);
      projectsRef.current = next;
      setProjects(next);
      noteLearning(Math.max(0, after - before)); // 今日 XP 按真实掌握/复习增量计
    },
    [activeId, pushCloud, noteLearning],
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
    if (cloudConfigured() && userIdRef.current) deleteRemoteProject(id).catch(() => {});
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
    dailyXp: daily?.xp ?? 0,
    dailyGoal: daily?.goal ?? 20,
    dailyPct: daily?.pct ?? 0,
    dailyGoalMet: daily?.goalMet ?? false,
    freezes: daily?.freezes ?? 0,
    calendar,
    goalNonce,
    setDailyGoal: updateDailyGoal,
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
    cloudOn,
    syncing,
    lastSync,
    syncNow,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProject(): ProjectContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useProject 必须在 ProjectProvider 内使用");
  return v;
}
