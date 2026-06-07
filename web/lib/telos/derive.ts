// 倒推端点：调用本地 serve.py 或线上 Cloudflare Worker，得到知识图谱。
// 端点地址来自构建期环境变量 NEXT_PUBLIC_TELOS_DERIVE_URL，可被 localStorage 覆盖
//（这样用户不用重新构建，直接在页面里粘贴本地地址就能体验）。
"use client";

import type { DomainClass } from "./engine";

const LS_KEY = "telos:derive-url";
const DOMAINS = new Set(["A", "B", "C", "D", "E", "F"]);

// 剥掉选项文本里 LLM 自带的序号前缀（如 "A. " / "B、" / "1) "），避免和角标重复。
export function stripOptionLabel(s: string): string {
  return String(s).replace(/^\s*[A-Da-d1-4１-４一二三四][.\．、)）:：]\s*/, "").trim();
}

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
  desc?: string;
  drill?: string;
  benchmark?: string;
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
      desc: String(p.desc ?? "")
        .replace(/^\s*can-?do\s*[:：]\s*/i, "")
        .trim(),
      drill: String(p.drill ?? "").trim(),
      benchmark: String(p.benchmark ?? "").trim(),
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

// 交互式微课的分步状态机（#9）：预测→讲解→分步范例→自我解释→渐隐填空→无脚手架检索。
export type LessonStep =
  | { kind: "predict"; prompt: string; options: string[]; answer: number; reveal?: string }
  | { kind: "explain"; text: string; analogy?: string }
  | { kind: "worked"; problem: string; steps: { do: string; why?: string }[] }
  | { kind: "self_explain"; prompt: string; options: string[]; answer: number; rationale?: string }
  | {
      kind: "faded";
      problem?: string;
      given?: string[];
      prompt: string;
      options: string[];
      answer: number;
      hints?: string[];
      rationale?: string;
    }
  | { kind: "retrieve"; prompt: string; options: string[]; answer: number; hints?: string[]; rationale?: string };

// 资源/引用：联网检索命中时带真实 url + domain（像 ChatGPT/Perplexity 的出处卡片）；
// 未配检索 key 时降级，只有 name + platform（前端回退到平台搜索链接）。
export interface LessonResource {
  name: string;
  platform?: string;
  url?: string;
  domain?: string;
  snippet?: string;
}

export interface Lesson {
  concept: string;
  steps: LessonStep[];
  resources?: LessonResource[];
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
  const steps = (Array.isArray(data.steps) ? data.steps : []) as LessonStep[];
  if (!steps.length) throw new Error("微课返回不完整");
  // 去掉选项里 LLM 自带的 A./B、序号前缀，避免和角标重复
  for (const s of steps) {
    const opts = (s as { options?: unknown }).options;
    if (Array.isArray(opts)) (s as { options: string[] }).options = opts.map((o) => stripOptionLabel(String(o)));
  }
  const resources = (Array.isArray(data.resources) ? data.resources : [])
    .map((raw): LessonResource | null => {
      const r = raw as Record<string, unknown>;
      const name = String(r.name ?? "").trim();
      if (!name) return null;
      const url = String(r.url ?? "").trim();
      return {
        name,
        platform: String(r.platform ?? "").trim() || undefined,
        url: url || undefined,
        domain: String(r.domain ?? "").trim() || undefined,
        snippet: String(r.snippet ?? "").trim() || undefined,
      };
    })
    .filter((r): r is LessonResource => r !== null);
  return { concept: String(data.concept ?? ""), steps, resources };
}

// ---- 起点诊断题（批量客观探针）----

export interface Probe {
  q: string;
  options: string[];
  answer: number;
  rationale: string;
}

export function getProbeUrl(): string {
  const u = getDeriveUrl();
  return u ? u.replace(/\/derive\/?$/, "/probe") : "";
}

export async function generateProbes(
  points: { id: string; name: string; domain?: string }[],
  goal: string,
  signal?: AbortSignal,
): Promise<Record<string, Probe>> {
  const url = getProbeUrl();
  if (!url) throw new Error("NO_ENDPOINT");
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ points, goal }),
      signal,
    });
  } catch {
    throw new Error("连不上诊断服务（确认 serve.py 在运行，或端点正确）");
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(String(data.error || `服务返回 HTTP ${res.status}`));
  const probes = data.probes as Record<string, Probe> | undefined;
  if (!probes || !Object.keys(probes).length) throw new Error("诊断题返回为空");
  for (const k of Object.keys(probes)) probes[k].options = (probes[k].options || []).map(stripOptionLabel);
  return probes;
}
