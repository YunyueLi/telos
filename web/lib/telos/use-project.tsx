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
import {
  cleanBaseUrl,
  cleanupStaleEndpointOverride,
  deriveGraph,
  generateTitle,
  getLlmConfig,
  setKeyActive,
  setLlmConfig,
  type LlmConfig,
} from "./derive";
import {
  addDailyXp,
  computeXp,
  getDailyInfo,
  noteDerive,
  setDailyGoal,
  redeemFreeze,
  type DailyInfo,
} from "./xp";
import { useAuth } from "./auth";
import { cloudConfigured, supabase } from "./supabase";
import { clearEntitlement, isPro, refreshEntitlement } from "./billing";
import { BILLING } from "./billing-config";
import { deleteRemoteProject, pullProjects, pushProject, pullState, pushState } from "./cloud";
import { applyLocalState, collectLocalState, mergeState, normalizeSyncState } from "./sync-state";

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
  spendable: number; // 可花费 XP（兑换断签保护）
  canRedeem: boolean; // 可兑换断签保护（XP 够 + 未满）
  freezeCost: number; // 兑换 1 个保护所需 XP
  dailyVersion: number; // 每次学习/改目标自增 → 供月历等重算
  goalNonce: number; // 每次"刚达成今日目标"自增 → 触发庆祝
  setDailyGoal: (g: number) => void;
  redeemFreeze: () => void;
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
  syncError: string | null; // 上次同步的真实报错（表没建 / RLS 等）；null=正常
  syncNow: () => Promise<void>;
}

const Ctx = createContext<ProjectContextValue | null>(null);

const byRecent = (a: Project, b: Project) => (b.updatedAt || 0) - (a.updatedAt || 0);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  const [ready, setReady] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActive] = useState<string | null>(null);
  // 默认 true：打开首页先看到「新学习」目标输入（ChatGPT 式）；点「地图」Tab / 切换项目 / 倒推完成则进入地图。
  // 一次性标记 telos:open-map（模板店导入等场景设置）：本次加载直达地图。
  const [composing, setComposing] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        if (window.sessionStorage.getItem("telos:open-map") === "1") {
          window.sessionStorage.removeItem("telos:open-map");
          return false;
        }
      } catch {
        /* ignore */
      }
    }
    return true;
  });
  const [dailyVersion, setDailyVersion] = useState(0); // 每次学习/改目标自增 → 重算每日信息
  const [goalNonce, setGoalNonce] = useState(0); // 刚达成今日目标 → 触发庆祝
  const [deriving, setDeriving] = useState(false);
  const projectsRef = useRef<Project[]>([]); // 与 projects 同步，供 mutateActive 同步读取算 XP delta
  const [deriveError, setDeriveError] = useState<string | null>(null);
  const { user, ready: authReady } = useAuth();
  const userIdRef = useRef<string | null>(null);
  const syncedRef = useRef<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const cloudOn = cloudConfigured() && !!user;

  useEffect(() => {
    cleanupStaleEndpointOverride(); // 生产页清掉残留的 localhost 端点覆盖（早期调试遗留）
    // 规整本机残留的脏 base（如历史误填的 "DeepSeek"）：直连模式不靠它，但清掉免得同步到别的设备/迷惑排查
    const c = getLlmConfig();
    if (c.key && c.base && cleanBaseUrl(c.base) !== c.base) {
      setLlmConfig({ ...c, base: cleanBaseUrl(c.base), updatedAt: c.updatedAt || Date.now() });
    }
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

  const doRedeemFreeze = useCallback(() => {
    redeemFreeze();
    setDailyVersion((v) => v + 1);
  }, []);

  // 把更新后的项目并入列表（去重 + 按最近排序）
  const merge = useCallback((p: Project) => {
    setProjects((prev) => [p, ...prev.filter((x) => x.id !== p.id)].sort(byRecent));
  }, []);

  // 云端推送（已配置且已登录时）——即发即忘不打断本地，但失败要让用户可见（不再静默吞掉）。
  const pushCloud = useCallback((p: Project) => {
    if (!cloudConfigured() || !userIdRef.current) return;
    pushProject(p)
      .then((res) => setSyncError(res.ok ? null : (res.error ?? "sync-failed")))
      .catch((e) => setSyncError(String(e?.message ?? e)));
  }, []);

  // 拉取远端 + 按 updatedAt 合并（per-project 最后写入者胜）+ 回推本地更新者。
  const syncNow = useCallback(async () => {
    if (!cloudConfigured() || !userIdRef.current) return;
    setSyncing(true);
    try {
      const { data: remote, error: pullErr } = await pullProjects();
      if (pullErr) {
        setSyncError(pullErr); // 表没建 / RLS 拒绝等 → 透出真实原因，且不写 lastSync（不假装「已同步」）
        return;
      }
      const m = new Map<string, Project>();
      for (const p of [...remote, ...listProjects()]) {
        const ex = m.get(p.id);
        if (!ex || (p.updatedAt || 0) > (ex.updatedAt || 0)) m.set(p.id, p);
      }
      const merged = [...m.values()].sort(byRecent);
      for (const p of merged) upsertProject(p);
      setProjects(merged);
      // 刷新「当前项目」React state：getActiveId() 已含「localStorage 未存 → 取最近项目」兜底。
      // 新设备首次登录时 mount 阶段 listProjects 为空、activeId 停在 null；同步 upsert 后必须重取一次，
      // 否则顶栏切换器读 project=null 不显示，要手动点项目（switchProject）才出现（用户实测反馈）。
      const active = getActiveId();
      if (active) setActiveId(active); // 命中「最近项目」兜底时落盘 telos:active，持久化此选择
      setActive(active);
      let pushErr: string | null = null;
      for (const p of merged) {
        const r = remote.find((x) => x.id === p.id);
        if (!r || (p.updatedAt || 0) > (r.updatedAt || 0)) {
          const res = await pushProject(p);
          if (!res.ok && !pushErr) pushErr = res.error ?? "sync-failed";
        }
      }
      if (pushErr) {
        setSyncError(pushErr);
        return;
      }

      // —— 账号级状态（连胜/打卡/墨/装扮）：拉取 → 无损合并 → 回写本机 → 回推 ——
      const { data: remoteStateRaw, error: statePullErr } = await pullState();
      if (statePullErr) {
        setSyncError(statePullErr);
        return;
      }
      const mergedState = remoteStateRaw
        ? mergeState(collectLocalState(), normalizeSyncState(remoteStateRaw))
        : collectLocalState();
      applyLocalState(mergedState);
      const statePush = await pushState(mergedState);
      if (!statePush.ok) {
        setSyncError(statePush.error ?? "sync-failed");
        return;
      }
      setDailyVersion((v) => v + 1); // 刷新坚持页 / 墨 / 解锁判定

      setSyncError(null); // 全程无错 → 清掉旧错误
      setLastSync(Date.now());
    } finally {
      setSyncing(false);
    }
  }, []);

  // 登录后自动同步一次（按 user.id 去重，token 刷新不重复触发）。
  useEffect(() => {
    userIdRef.current = user?.id ?? null;
    if (!cloudConfigured()) {
      setKeyActive(true); // 自托管 / 未配账号体系：本机 key 恒激活，不受登录态影响
      return;
    }
    if (!authReady) return; // 等会话解析完再判断，避免加载瞬间闪烁
    // key 跟账号走：登录→激活、登出→休眠。休眠只是【停止发送 key（→ 未连接）】，绝不删除本机 key——
    // 避免误删唯一副本（账号端若没成功推送过，删本机即彻底丢失）。
    setKeyActive(!!user);
    if (!user) {
      syncedRef.current = null;
      clearEntitlement(); // 登出：清本机 Pro 权益缓存，避免下一个登录者串号
      return;
    }
    if (syncedRef.current === user.id) return;
    syncedRef.current = user.id;
    void refreshEntitlement(); // 登录：拉取账号 Pro 权益（webhook 写入的 app_metadata）
    // BYOK：登录时本机 ↔ 账号双向对账（后写入者胜，按 updatedAt）。
    // 关键：用 getUser() 拉【服务端最新】user_metadata——session 里的 JWT 可能是本设备早先登录时的旧缓存，
    // 缺后来在另一台设备绑定的 key，只读 JWT 会导致「新设备登录仍未连接」。getUser 失败时回退 JWT 值。
    void (async () => {
      const sb = supabase();
      let remoteLlm = (user.user_metadata as { telos_llm?: LlmConfig } | undefined)?.telos_llm;
      try {
        const res = await sb?.auth.getUser();
        const fresh = (res?.data?.user?.user_metadata as { telos_llm?: LlmConfig } | undefined)?.telos_llm;
        if (fresh && typeof fresh === "object") remoteLlm = fresh;
      } catch {
        /* 网络异常 → 用 JWT 里的兜底 */
      }
      const localLlm = getLlmConfig();
      const rKey = (remoteLlm?.key || "").trim();
      const lKey = (localLlm.key || "").trim();
      const rT = remoteLlm?.updatedAt || 0;
      const lT = localLlm.updatedAt || 0;
      let action = "noop";
      if (rKey && (!lKey || rT > lT)) {
        // 账号端有 key（且更新 / 本机没配）→ 拉回本机（setLlmConfig 广播事件，接入状态卡即时重测）。
        setLlmConfig({ ...localLlm, ...remoteLlm });
        action = "pulled";
      } else if (lKey && (!rKey || lT > rT)) {
        // 本机更新（或账号端还没有）→ 推到账号，让其它设备登录后拿得到（base 规整后再推，不存脏值）。
        sb?.auth
          .updateUser({ data: { telos_llm: { ...localLlm, base: cleanBaseUrl(localLlm.base), updatedAt: lT || Date.now() } } })
          .catch(() => {});
        action = "pushed";
      }
      // 一行诊断：新设备拉不到 key 时，看这行能判断是「账号端就没 key」还是别的。
      console.info("[telos] BYOK sync", { hasRemoteKey: !!rKey, hasLocalKey: !!lKey, action });
    })();
    void syncNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authReady]);

  const derive = useCallback(
    async (goal: string): Promise<boolean> => {
      const g = goal.trim();
      if (!g) return false;
      // 免费版项目数上限（Pro 无限）：倒推=新建项目，超限时引导升级或先删旧项目
      if (!isPro() && listProjects().length >= BILLING.freeProjectLimit) {
        setDeriveError(`${t("pro.limitT", { n: BILLING.freeProjectLimit })} — ${t("pro.limitD")}`);
        return false;
      }
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
        setDeriveError(
          msg === "NO_ENDPOINT"
            ? t("err.noEndpointDerive")
            : msg === "NO_KEY"
              ? t("err.noKeyDerive")
              : msg,
        );
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
    spendable: daily?.spendable ?? 0,
    canRedeem: daily?.canRedeem ?? false,
    freezeCost: daily?.freezeCost ?? 100,
    dailyVersion,
    goalNonce,
    setDailyGoal: updateDailyGoal,
    redeemFreeze: doRedeemFreeze,
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
    syncError,
    syncNow,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProject(): ProjectContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useProject 必须在 ProjectProvider 内使用");
  return v;
}
