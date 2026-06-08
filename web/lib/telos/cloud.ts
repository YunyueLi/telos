"use client";

// 跨设备同步：把学习项目库（telos:projects）按「每项一行」存到 Supabase。
// 表 public.projects(user_id uuid default auth.uid(), id text, data jsonb, updated_at timestamptz, pk(user_id,id))，
// 受 RLS 保护（仅本人可读写）。合并策略：按 data.updatedAt 最后写入者胜（per-project）。
// 见 SUPABASE.md 建表脚本。未配置 / 未登录时所有函数安全空转。
import { supabase } from "./supabase";
import type { Project } from "./project";

const TABLE = "projects";

function valid(p: unknown): p is Project {
  const o = p as Project | null;
  return !!o && typeof o.id === "string" && Array.isArray(o.points) && o.points.length > 0 && !!o.state;
}

async function uid(): Promise<string | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function pullProjects(): Promise<Project[]> {
  const sb = supabase();
  if (!sb) return [];
  const { data, error } = await sb.from(TABLE).select("data");
  if (error || !data) return [];
  return data.map((r) => (r as { data: unknown }).data).filter(valid);
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
