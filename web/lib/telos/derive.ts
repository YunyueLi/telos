// 倒推端点：调用本地 serve.py 或线上 Cloudflare Worker，得到知识图谱。
// 端点地址来自构建期环境变量 NEXT_PUBLIC_TELOS_DERIVE_URL，可被 localStorage 覆盖
//（这样用户不用重新构建，直接在页面里粘贴本地地址就能体验）。
"use client";

import type { DomainClass } from "./engine";
import { currentLang, llmName, tStatic } from "./i18n";

// 当前界面语言对应的 LLM 输出语言名（注入后端 prompt，让倒推/微课/诊断都用该语言生成）。
function outputLang(): string {
  return llmName(currentLang());
}

const LS_KEY = "telos:derive-url";
const DOMAINS = new Set(["A", "B", "C", "D", "E", "F"]);

// 本地零配置：跑在 localhost 且没配端点时，默认指向本地 serve.py（启动 serve.py 即开箱可用）。
export const LOCAL_ENDPOINT = "http://127.0.0.1:8787/derive";

function isLocalHost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0";
}

// 剥掉选项文本里 LLM 自带的序号前缀（如 "A. " / "B、" / "1) "），避免和角标重复。
export function stripOptionLabel(s: string): string {
  return String(s).replace(/^\s*[A-Da-d1-4１-４一二三四][.\．、)）:：]\s*/, "").trim();
}

export function envDeriveUrl(): string {
  return (process.env.NEXT_PUBLIC_TELOS_DERIVE_URL ?? "").trim();
}

export function getDeriveUrl(): string {
  if (typeof window !== "undefined") {
    const override = (window.localStorage.getItem(LS_KEY) || "").trim();
    // 忽略「在非本机页面上指向 localhost 的过时覆盖」——否则线上会去打本地 serve.py，必然失败
    //（常见于先本地开发、后用同一浏览器开线上版，残留了 telos:derive-url=127.0.0.1）。
    const isLocalUrl = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i.test(override);
    if (override && !(isLocalUrl && !isLocalHost())) return override;
  }
  const env = envDeriveUrl();
  if (env) return env;
  if (isLocalHost()) return LOCAL_ENDPOINT; // 本地零配置
  return "";
}

// 健康检查端点（与 derive 同源）：把 /derive|/lesson|/probe 换成 /health。
export function getHealthUrl(url?: string): string {
  const u = (url ?? getDeriveUrl()).trim();
  if (!u) return "";
  return u.replace(/\/(derive|lesson|probe)\/?$/, "") + "/health";
}

// ---- BYOK：用户自带的 LLM 配置（key/base/model + 联网检索）。存 localStorage，登录后随账号同步。----
// key 只随请求发往倒推端点（你的 Worker 或本地 serve.py），端点不落盘、不记录；绝不进任何前端构建产物。
const LLM_KEY = "telos:llm";
// 配置变更事件：setLlmConfig / setKeyActive 后广播，让接入状态卡等监听方即时重测。
export const LLM_EVENT = "telos:llm";

// key 是否「激活」：云端已配置时，仅登录后激活；自托管（未配账号体系）恒激活。
// 休眠 = 不发送 key（显示未连接），但【不删除本机 key】——避免误删唯一副本。由 Provider 按登录态设置。
let _keyActive = true;
export function setKeyActive(active: boolean): void {
  if (_keyActive === active) return;
  _keyActive = active;
  if (typeof window !== "undefined") window.dispatchEvent(new Event(LLM_EVENT));
}
export function keyActive(): boolean {
  return _keyActive;
}
export interface LlmConfig {
  key?: string;
  base?: string;
  model?: string;
  searchProvider?: string;
  searchKey?: string;
  updatedAt?: number; // 最后修改时间戳，用于本机 ↔ 账号的「后写入者胜」对账
}
export function getLlmConfig(): LlmConfig {
  if (typeof window === "undefined") return {};
  try {
    return (JSON.parse(window.localStorage.getItem(LLM_KEY) || "{}") as LlmConfig) || {};
  } catch {
    return {};
  }
}
export function setLlmConfig(c: LlmConfig): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LLM_KEY, JSON.stringify(c));
    window.dispatchEvent(new Event(LLM_EVENT));
  } catch {
    /* ignore */
  }
}
export function hasLlmKey(): boolean {
  return !!(getLlmConfig().key || "").trim();
}

// 规整用户填写的 API Base URL：容错常见写法；非法则返回 undefined（调用方回退默认 DeepSeek）。
// - 去空白与尾部斜杠；剥掉误粘的 /chat/completions（含 /v1/chat/completions）后缀；缺协议补 https://
// - 必须是合法 http(s) URL 且主机像域名（含点）或 localhost / IP，否则视为无效
//   （如误把 "DeepSeek" 当地址填进来 → "https://deepseek" 主机无点 → 无效 → 用默认）
export function cleanBaseUrl(raw?: string): string | undefined {
  let s = String(raw ?? "").trim().replace(/\s+/g, "");
  if (!s) return undefined;
  s = s.replace(/\/+$/, "").replace(/\/(v1\/)?chat\/completions$/i, (_m, v1) => (v1 ? "/v1" : "")).replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return undefined;
  }
  const host = u.hostname.toLowerCase();
  const looksHost = host === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(".");
  if (!looksHost) return undefined;
  const path = u.pathname === "/" ? "" : u.pathname.replace(/\/+$/, "");
  return u.origin + path;
}

// 把用户自带配置拼成请求头（随每次倒推/微课/诊断调用发出）。
function llmHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (!_keyActive) return h; // 休眠（云端已配置但未登录）→ 不发自带配置 → 服务端无 key → 未连接（本机 key 保留）
  const c = getLlmConfig();
  if (c.key && c.key.trim()) h["X-Telos-Key"] = c.key.trim();
  const base = cleanBaseUrl(c.base); // 只发合法 base，过滤掉如 "DeepSeek" 这类残留的非法值
  if (base) h["X-Telos-Base"] = base;
  if (c.model && c.model.trim()) h["X-Telos-Model"] = c.model.trim();
  if (c.searchProvider && c.searchProvider.trim()) h["X-Telos-Search-Provider"] = c.searchProvider.trim();
  if (c.searchKey && c.searchKey.trim()) h["X-Telos-Search-Key"] = c.searchKey.trim();
  return h;
}

export interface EndpointStatus {
  ok: boolean;
  model?: string;
  available?: boolean;
  search?: { provider: string; available: boolean };
  error?: string;
}

// 测试端点连通性 + key 是否就绪（打一次 /health，零成本，不调用 LLM）。
export async function testEndpoint(url?: string): Promise<EndpointStatus> {
  const health = getHealthUrl(url);
  if (!health) return { ok: false, error: tStatic("epc.needUrl") };
  let res: Response;
  try {
    res = await fetch(health, { method: "GET", headers: llmHeaders() });
  } catch {
    return { ok: false, error: tStatic("epc.cantConnect") };
  }
  if (!res.ok) return { ok: false, error: tStatic("epc.httpErr", { code: res.status }) };
  const d = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const s = d.search as { provider?: unknown; available?: unknown } | undefined;
  return {
    ok: true,
    model: d.model ? String(d.model) : undefined,
    available: d.available !== false,
    search: s ? { provider: String(s.provider ?? "none"), available: s.available === true } : undefined,
  };
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
  module?: string;
  moduleTitle?: string;
}

export interface DerivedGraph {
  goal: string;
  title?: string; // LLM 概括的简洁主题标题（导航栏显示；缺省回退到 goal）
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
      module: String(p.module ?? "").trim(),
      moduleTitle: String(p.moduleTitle ?? p.module_title ?? "").trim(),
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
      headers: llmHeaders(),
      body: JSON.stringify({ goal, lang: outputLang() }),
      signal,
    });
  } catch {
    throw new Error(tStatic("err.cantReachDerive"));
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(String(data.error || tStatic("err.httpStatus", { status: res.status })));
  const points = data.points;
  if (!Array.isArray(points) || points.length === 0) throw new Error(tStatic("err.noPoints"));
  return {
    goal: String(data.goal ?? goal),
    title: String(data.title ?? "").trim() || undefined,
    points: normalize(points),
  };
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
      headers: llmHeaders(),
      body: JSON.stringify({ ...input, lang: outputLang() }),
      signal,
    });
  } catch {
    throw new Error(tStatic("err.cantReachLesson"));
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(String(data.error || tStatic("err.httpStatus", { status: res.status })));
  const steps = (Array.isArray(data.steps) ? data.steps : []) as LessonStep[];
  if (!steps.length) throw new Error(tStatic("err.lessonIncomplete"));
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

// 概括标题（给旧项目补标题）：轻量纯文本调用；未配置/失败 → ""（调用方回退到原 goal）。
export function getTitleUrl(): string {
  const u = getDeriveUrl();
  return u ? u.replace(/\/derive\/?$/, "/title") : "";
}

export async function generateTitle(goal: string): Promise<string> {
  const url = getTitleUrl();
  if (!url || !goal.trim()) return "";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: llmHeaders(),
      body: JSON.stringify({ goal, lang: outputLang() }),
    });
    if (!res.ok) return "";
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return String(data.title ?? "").trim();
  } catch {
    return "";
  }
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
      headers: llmHeaders(),
      body: JSON.stringify({ points, goal, lang: outputLang() }),
      signal,
    });
  } catch {
    throw new Error(tStatic("err.cantReachProbe"));
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(String(data.error || tStatic("err.httpStatus", { status: res.status })));
  const probes = data.probes as Record<string, Probe> | undefined;
  if (!probes || !Object.keys(probes).length) throw new Error(tStatic("err.probeEmpty"));
  for (const k of Object.keys(probes)) probes[k].options = (probes[k].options || []).map(stripOptionLabel);
  return probes;
}
