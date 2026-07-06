"use client";

// 跨设备同步：把学习项目库（telos:projects）按「每项一行」存到 Supabase。
// 表 public.projects(user_id uuid default auth.uid(), id text, data jsonb, updated_at timestamptz, pk(user_id,id))，
// 受 RLS 保护（仅本人可读写）。合并策略：按 data.updatedAt 最后写入者胜（per-project）。
// 见 SUPABASE.md 建表脚本。未配置 / 未登录时所有函数安全空转。
import { supabase } from "./supabase";
import { normalizeProject, type Project } from "./project";

const TABLE = "projects";
const LEADERBOARD_TABLE = "leaderboard";

type AuthUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

function valid(p: unknown): p is Project {
  const o = p as Project | null;
  return !!o && typeof o.id === "string" && Array.isArray(o.points) && o.points.length > 0 && !!o.state;
}

async function currentUser(): Promise<AuthUser | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return (data.session?.user as AuthUser | undefined) ?? null;
}

async function uid(): Promise<string | null> {
  return (await currentUser())?.id ?? null;
}

// 返回 {data, error}：error 非空时把 Supabase 原始报错透出（表没建 / RLS 拒绝等），
// 交给上层显示给用户——绝不再静默吞错、假装「已同步」。
export async function pullProjects(): Promise<{ data: Project[]; error: string | null }> {
  const sb = supabase();
  if (!sb) return { data: [], error: null };
  const { data, error } = await sb.from(TABLE).select("data");
  if (error) return { data: [], error: error.message };
  // 补全 state（云端可能存着旧格式/残缺数据）→ 同步进 React state 渲染时不白屏。
  const list = (data ?? []).map((r) => (r as { data: unknown }).data).filter(valid).map(normalizeProject);
  return { data: list, error: null };
}

export async function pushProject(p: Project): Promise<{ ok: boolean; error?: string }> {
  const sb = supabase();
  if (!sb) return { ok: false, error: "unconfigured" };
  const user_id = await uid();
  if (!user_id) return { ok: false, error: "signed-out" };
  const { error } = await sb
    .from(TABLE)
    .upsert(
      { user_id, id: p.id, data: p, updated_at: new Date(p.updatedAt || Date.now()).toISOString() },
      { onConflict: "user_id,id" },
    );
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function pushAll(projects: Project[]): Promise<void> {
  for (const p of projects) await pushProject(p);
}

export async function deleteRemoteProject(id: string): Promise<void> {
  const sb = supabase();
  if (!sb) return;
  const user_id = await uid();
  if (!user_id) return;
  await sb.from(TABLE).delete().eq("user_id", user_id).eq("id", id);
}

// ---- 账号级单例状态（连胜/打卡/墨/装扮）：表 public.user_state，每人一行 jsonb。----
const STATE_TABLE = "user_state";

export async function pullState(): Promise<{ data: unknown | null; error: string | null }> {
  const sb = supabase();
  if (!sb) return { data: null, error: null };
  const user_id = await uid();
  if (!user_id) return { data: null, error: "signed-out" };
  const { data, error } = await sb.from(STATE_TABLE).select("data").eq("user_id", user_id).maybeSingle();
  if (error) return { data: null, error: error.message };
  return { data: (data as { data: unknown } | null)?.data ?? null, error: null };
}

export async function pushState(data: unknown): Promise<{ ok: boolean; error?: string }> {
  const sb = supabase();
  if (!sb) return { ok: false, error: "unconfigured" };
  const user_id = await uid();
  if (!user_id) return { ok: false, error: "signed-out" };
  const { error } = await sb
    .from(STATE_TABLE)
    .upsert({ user_id, data, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  return error ? { ok: false, error: error.message } : { ok: true };
}

// ---- 本周联赛：按 ISO 周汇总真实 XP。参榜可关闭；关闭后行仍属本人，但 opted_in=false，不会被公共榜读到。----
export interface LeaderboardEntry {
  userId: string;
  name: string;
  xp: number;
  rank: number;
  self: boolean;
  gapToNext: number;
  updatedAt: string | null;
}

export interface LeaderboardData {
  week: string;
  entries: LeaderboardEntry[];
  self: LeaderboardEntry | null;
  total: number;
}

function cleanName(user: AuthUser): string {
  const meta = user.user_metadata ?? {};
  const raw =
    [meta.full_name, meta.name, meta.user_name, user.email?.split("@")[0]].find((v) => typeof v === "string" && v.trim()) ??
    "Telos Learner";
  return String(raw).replace(/[\r\n\t]+/g, " ").trim().slice(0, 32) || "Telos Learner";
}

export async function reportWeekXp(week: string, xp: number, optedIn = true): Promise<{ ok: boolean; error?: string }> {
  const sb = supabase();
  if (!sb) return { ok: false, error: "unconfigured" };
  const user = await currentUser();
  if (!user) return { ok: false, error: "signed-out" };
  const { error } = await sb.from(LEADERBOARD_TABLE).upsert(
    {
      week,
      user_id: user.id,
      name: cleanName(user),
      xp: optedIn ? Math.max(0, Math.round(xp)) : 0,
      opted_in: optedIn,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "week,user_id" },
  );
  return error ? { ok: false, error: error.message } : { ok: true };
}

type LeaderboardRow = {
  user_id: string;
  name: string | null;
  xp: number | null;
  updated_at: string | null;
};

export async function pullLeaderboard(week: string, limit = 30): Promise<{ data: LeaderboardData; error: string | null }> {
  const empty: LeaderboardData = { week, entries: [], self: null, total: 0 };
  const sb = supabase();
  if (!sb) return { data: empty, error: null };
  const selfId = (await currentUser())?.id ?? null;
  const fetchLimit = Math.max(limit, 500);
  const { data, error, count } = await sb
    .from(LEADERBOARD_TABLE)
    .select("user_id,name,xp,updated_at", { count: "exact" })
    .eq("week", week)
    .eq("opted_in", true)
    .order("xp", { ascending: false })
    .order("updated_at", { ascending: true })
    .limit(fetchLimit);
  if (error) return { data: empty, error: error.message };

  const rows = ((data ?? []) as LeaderboardRow[]).filter((r) => typeof r.user_id === "string");
  const ranked: LeaderboardEntry[] = rows.map((r, i, arr) => {
    const above = i > 0 ? arr[i - 1] : null;
    const xp = Math.max(0, Math.round(r.xp ?? 0));
    return {
      userId: r.user_id,
      name: (r.name || "Telos Learner").trim().slice(0, 32),
      xp,
      rank: i + 1,
      self: r.user_id === selfId,
      gapToNext: above ? Math.max(0, Math.round((above.xp ?? 0) - xp)) : 0,
      updatedAt: r.updated_at,
    };
  });
  return {
    data: {
      week,
      entries: ranked.slice(0, limit),
      self: ranked.find((r) => r.self) ?? null,
      total: count ?? ranked.length,
    },
    error: null,
  };
}
