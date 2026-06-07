// 倒推端点：调用本地 serve.py 或线上 Cloudflare Worker，得到知识图谱。
// 端点地址来自构建期环境变量 NEXT_PUBLIC_TELOS_DERIVE_URL，可被 localStorage 覆盖
//（这样用户不用重新构建，直接在页面里粘贴本地地址就能体验）。
"use client";

import type { DomainClass } from "./engine";

const LS_KEY = "telos:derive-url";
const DOMAINS = new Set(["A", "B", "C", "D", "E", "F"]);

export function envDeriveUrl(): string {
  return (process.env.NEXT_PUBLIC_TELOS_DERIVE_URL ?? "").trim();
}

export function getDeriveUrl(): string {
  if (typeof window !== "undefined") {
    const override = window.localStorage.getItem(LS_KEY);
    if (override && override.trim()) return override.trim();
  }
  return envDeriveUrl();
}

export function setDeriveUrl(url: string): void {
  if (typeof window === "undefined") return;
  const v = url.trim();
  if (v) window.localStorage.setItem(LS_KEY, v);
  else window.localStorage.removeItem(LS_KEY);
}

export function deriveConfigured(): boolean {
  return !!getDeriveUrl();
}

export interface DerivedPoint {
  id: string;
  name: string;
  prereqs: string[];
  isGoal?: boolean;
  minutes?: number;
  domain?: DomainClass;
}

export interface DerivedGraph {
  goal: string;
  points: DerivedPoint[];
}

// 把端点返回的 points 规整成前端 engine.ts 能直接吃的形状（容错老式 snake_case 字段）。
function normalize(points: unknown[]): DerivedPoint[] {
  return points.map((raw) => {
    const p = raw as Record<string, unknown>;
    const prereqs = (p.prereqs ?? p.prerequisites ?? []) as unknown[];
    const dom = String(p.domain ?? p.domainClass ?? "B").trim().toUpperCase();
    return {
      id: String(p.id),
      name: String(p.name ?? p.id),
      prereqs: prereqs.map(String),
      isGoal: Boolean(p.isGoal ?? p.is_goal ?? false),
      minutes: Number(p.minutes ?? 25) || 25,
      domain: (DOMAINS.has(dom) ? dom : "B") as DomainClass,
    };
  });
}

export async function deriveGraph(goal: string, signal?: AbortSignal): Promise<DerivedGraph> {
  const url = getDeriveUrl();
  if (!url) throw new Error("NO_ENDPOINT");
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal }),
      signal,
    });
  } catch {
    throw new Error("连不上倒推服务（确认 serve.py 在运行，或端点地址正确）");
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(String(data.error || `服务返回 HTTP ${res.status}`));
  const points = data.points;
  if (!Array.isArray(points) || points.length === 0) throw new Error("返回数据里没有 points");
  return { goal: String(data.goal ?? goal), points: normalize(points) };
}

// ---- 按需微课 ----

export interface Lesson {
  explain: string;
  worked: { problem: string; steps: string[] };
  check: { q: string; options: string[]; answer: number; rationale: string };
}

export function getLessonUrl(): string {
  const u = getDeriveUrl();
  return u ? u.replace(/\/derive\/?$/, "/lesson") : "";
}

export async function generateLesson(
  input: { name: string; domain?: string; prereqs?: string[]; goal?: string },
  signal?: AbortSignal,
): Promise<Lesson> {
  const url = getLessonUrl();
  if (!url) throw new Error("NO_ENDPOINT");
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal,
    });
  } catch {
    throw new Error("连不上微课服务（确认 serve.py 在运行，或端点正确）");
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(String(data.error || `服务返回 HTTP ${res.status}`));
  const check = data.check as { options?: unknown[] } | undefined;
  if (!data.explain || !check?.options?.length) throw new Error("微课返回不完整");
  return data as unknown as Lesson;
}
