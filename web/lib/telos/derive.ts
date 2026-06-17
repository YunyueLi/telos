// 倒推端点：调用本地 serve.py 或线上 Cloudflare Worker，得到知识图谱。
// 端点地址来自构建期环境变量 NEXT_PUBLIC_TELOS_DERIVE_URL，可被 localStorage 覆盖
//（这样用户不用重新构建，直接在页面里粘贴本地地址就能体验）。
"use client";

import type { DomainClass, KnowledgePoint } from "./engine";
import { currentLang, llmName, tStatic } from "./i18n";
import { deriveDirect, lessonDirect, probesDirect, testDirect, titleDirect, type DirectCfg } from "./derive-direct";

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
  const env = envDeriveUrl();
  if (typeof window !== "undefined") {
    const override = (window.localStorage.getItem(LS_KEY) || "").trim();
    if (isLocalHost()) {
      // 本机开发 / 自托管：覆盖优先（指向 serve.py 或自定义），其次构建端点，最后默认本地端点。
      if (override) return override;
      if (env) return env;
      return LOCAL_ENDPOINT;
    }
    // 生产页（如 GitHub Pages）：构建期端点是权威。【忽略本机残留的覆盖】——dev 调试遗留的
    // localhost / 旧地址会让线上去打一个打不通的端点（cantConnect）。自愈：硬刷新即恢复，无需清缓存。
    if (env) return env;
    // 仅当没有构建端点（裸静态部署）时，才允许运行时粘贴的【非 localhost】覆盖生效。
    const isLocalUrl = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i.test(override);
    if (override && !isLocalUrl) return override;
    return "";
  }
  return env; // SSR / 无 window
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

// ---- 直连模式（真·BYOK）：用户配了自己的 key 且激活 → 浏览器直连 provider，绕过代理 Worker。----
// 为什么：线上倒推 Worker 在 `*.workers.dev`，被 GFW 屏蔽（中国网络连接挂起）；用户自带的
// DeepSeek/Tavily 可直连且允许浏览器 CORS。直连零代理、零单点故障、各地都通。key 只发往用户自己的 provider。
export function directMode(): boolean {
  return keyActive() && hasLlmKey();
}

// ---- 托管模式（开箱即用 · 商业化主引擎）：无 BYOK 的登录用户 → Worker 用服务端 key 代为推理，----
// 按账号计量（Free 试用 / Pro 月度配额 / 加油包）。身份 = Supabase access_token（auth.tsx 随会话注入）。
let _hostedToken: string | null = null;
export function setHostedToken(token: string | null): void {
  const t = (token || "").trim() || null;
  if (t === _hostedToken) return;
  _hostedToken = t;
  try {
    window.dispatchEvent(new Event(LLM_EVENT)); // 登录态变化 → 引擎就绪状态变化，通知 UI 重判
  } catch {
    /* SSR/早期调用 */
  }
}
function isLocalUrl(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i.test(url);
}
// 托管就绪：配了端点且（本地 serve.py 不验身份 / 线上 Worker 需已登录携 token）。
export function hostedReady(): boolean {
  const url = getDeriveUrl();
  if (!url) return false;
  return isLocalUrl(url) || !!_hostedToken;
}
// 托管用量查询（/pro 页用量条）：未登录/未配端点/托管未开 → null。
export interface HostedUsage {
  pro: boolean;
  month: { d: number; l: number };
  trial: { d: number; l: number };
  bonus: { d: number; l: number };
  quota: { d: number; l: number };
}
export async function fetchHostedUsage(): Promise<HostedUsage | null> {
  const url = getDeriveUrl();
  if (!url || !_hostedToken) return null;
  try {
    const base = url.replace(/\/(derive|lesson|probe|title)\/?$/, "");
    const res = await fetch(`${base}/billing/usage`, {
      headers: { Authorization: `Bearer ${_hostedToken}` },
    });
    if (!res.ok) return null;
    const d = (await res.json()) as HostedUsage & { ok?: boolean };
    return d && d.quota ? d : null;
  } catch {
    return null;
  }
}

// 付费模板内容下发：完整图谱（desc/drill/benchmark）不在前端（防白嫖）——购买/Pro 后凭身份从 Worker /template 拉取。
// 失败抛本地化错误（未配端点 / 需登录 / 未拥有）。免费模板内容前端已内嵌，不走这里。
export async function fetchTemplatePoints(id: string): Promise<KnowledgePoint[]> {
  const url = getDeriveUrl();
  if (!url) throw new Error(tStatic("err.noTemplate"));
  if (!_hostedToken) throw new Error(tStatic("err.needLogin"));
  const base = url.replace(/\/(derive|lesson|probe|title)\/?$/, "");
  let res: Response;
  try {
    res = await fetch(`${base}/template`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${_hostedToken}` },
      body: JSON.stringify({ id }),
    });
  } catch {
    throw new Error(tStatic("err.cantReachDerive"));
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(hostedErrorMessage(data.error) || tStatic("err.noTemplate"));
  const points = data.points;
  if (!Array.isArray(points) || !points.length) throw new Error(tStatic("err.noTemplate"));
  return normalize(points) as KnowledgePoint[];
}

// ---- 完课证书验真：领证时登记（登录），/cert 页凭编号公开核验真伪。base 与倒推端点同源。----
export function certApiBase(): string {
  const url = getDeriveUrl();
  return url ? url.replace(/\/(derive|lesson|probe|title)\/?$/, "") : "";
}
export interface CertPayload {
  serial: string;
  name: string;
  goal: string;
  nodes: number;
  dateISO: string;
}
export async function registerCertificate(p: CertPayload): Promise<boolean> {
  const base = certApiBase();
  if (!base || !_hostedToken) return false; // 未配端点 / 未登录 → 不登记（证书仍可下载，只是不可验真）
  try {
    const res = await fetch(`${base}/cert/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${_hostedToken}` },
      body: JSON.stringify(p),
    });
    return res.ok;
  } catch {
    return false;
  }
}
export interface CertRecord {
  found: boolean;
  serial?: string;
  name?: string;
  goal?: string;
  nodes?: number;
  dateISO?: string;
}
export async function verifyCertificate(serial: string): Promise<CertRecord> {
  const base = certApiBase();
  if (!base) return { found: false };
  try {
    const res = await fetch(`${base}/cert/verify?no=${encodeURIComponent(serial)}`);
    if (!res.ok) return { found: false };
    return (await res.json()) as CertRecord;
  } catch {
    return { found: false };
  }
}

// 托管错误码 → 本地化文案（Worker 返回 {error:"<code>"}）。未识别返回 null 由调用方走通用错误。
function hostedErrorMessage(code: unknown): string | null {
  switch (String(code || "")) {
    case "NEED_LOGIN":
      return tStatic("err.needLogin");
    case "HOSTED_TRIAL_USED":
      return tStatic("err.trialUsed");
    case "HOSTED_QUOTA":
      return tStatic("err.hostedQuota");
    case "NO_HOSTED":
      return tStatic("err.noHosted");
    case "NOT_OWNED":
      return tStatic("err.notOwned");
    case "NO_TEMPLATE":
      return tStatic("err.noTemplate");
    default:
      return null;
  }
}
function directCfg(): DirectCfg {
  const c = getLlmConfig();
  return {
    key: (c.key || "").trim(),
    base: cleanBaseUrl(c.base),
    model: (c.model || "").trim() || undefined,
    searchProvider: (c.searchProvider || "").trim() || undefined,
    searchKey: (c.searchKey || "").trim() || undefined,
  };
}
// 引擎是否就绪（供 UI 门控）：直连(本机有 key·BYOK) 或 托管(登录即用 / 本地 serve.py)。
export function engineReady(): boolean {
  return directMode() || hostedReady();
}

// 一次性清理：生产页（非 localhost）若残留指向 localhost 的 `telos:derive-url` 覆盖（早期本地调试遗留），
// 直接删掉——它只会让无 key 的 Worker 回退路径去打一个本机打不通的地址。getDeriveUrl 已忽略它，这里再物理清除。
export function cleanupStaleEndpointOverride(): void {
  if (typeof window === "undefined" || isLocalHost()) return;
  const override = (window.localStorage.getItem(LS_KEY) || "").trim();
  if (override && /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i.test(override)) {
    window.localStorage.removeItem(LS_KEY);
  }
}

// 把用户自带配置拼成请求头（随每次倒推/微课/诊断调用发出）。
// 无 BYOK key 时附 Supabase token → Worker 走「托管模式」（服务端 key + 按账号计量）。
function llmHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (_keyActive) {
    const c = getLlmConfig();
    if (c.key && c.key.trim()) h["X-Telos-Key"] = c.key.trim();
    const base = cleanBaseUrl(c.base); // 只发合法 base，过滤掉如 "DeepSeek" 这类残留的非法值
    if (base) h["X-Telos-Base"] = base;
    if (c.model && c.model.trim()) h["X-Telos-Model"] = c.model.trim();
    if (c.searchProvider && c.searchProvider.trim()) h["X-Telos-Search-Provider"] = c.searchProvider.trim();
    if (c.searchKey && c.searchKey.trim()) h["X-Telos-Search-Key"] = c.searchKey.trim();
  }
  if (!h["X-Telos-Key"] && _hostedToken) h["Authorization"] = `Bearer ${_hostedToken}`;
  return h;
}

export interface EndpointStatus {
  ok: boolean;
  model?: string;
  available?: boolean;
  search?: { provider: string; available: boolean };
  error?: string;
}

// 测试端点连通性 + key 是否就绪。
export async function testEndpoint(url?: string): Promise<EndpointStatus> {
  // 直连模式：直接对用户自己的 provider 打一个极小请求，验可达性 + key 是否有效（不经任何代理）。
  if (directMode()) {
    const r = await testDirect(directCfg());
    if (!r.reachable) return { ok: false, error: tStatic("epc.cantConnect") };
    const c = getLlmConfig();
    const hasSearch = !!(c.searchKey && c.searchKey.trim());
    return {
      ok: true,
      model: r.model,
      available: r.keyOk,
      search: { provider: (c.searchProvider || "tavily").trim() || "tavily", available: hasSearch },
    };
  }
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
  return engineReady();
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

// 倒推真实进度（流式 / 直连共用）：按管线里程碑上报，前端据此画真进度条 + 模块清单 + 早出图。
export interface DeriveProgress {
  phase: "search" | "blueprint" | "expand" | "assemble" | "critique" | "single" | "assembled";
  modulesTotal?: number; // 蓝图判定的模块数（expand 阶段已知）
  modulesDone?: number; // 已完成展开的模块数
  modules?: { id: string; title: string }[]; // 模块清单（蓝图就绪时一次性给）
  doneId?: string; // 刚完成的模块 id
  graph?: DerivedGraph; // phase==="assembled"：装配好的可用图（critique 前）→ 可早跳地图
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

const NO_STREAM = "__NO_STREAM__"; // 哨兵：传输层不支持流式 → 回退单发 JSON（非倒推错误）

export async function deriveGraph(
  goal: string,
  signal?: AbortSignal,
  onProgress?: (p: DeriveProgress) => void,
): Promise<DerivedGraph> {
  if (directMode()) {
    // BYOK 直连：管线在浏览器跑，onProgress 直接回调（无需传输层）。
    const raw = await deriveDirect(goal, outputLang(), directCfg(), signal, onProgress);
    if (!Array.isArray(raw.points) || raw.points.length === 0) throw new Error(tStatic("err.noPoints"));
    return { goal: String(raw.goal ?? goal), title: String(raw.title ?? "").trim() || undefined, points: normalize(raw.points) };
  }
  const url = getDeriveUrl();
  if (!url) throw new Error("NO_ENDPOINT");
  // 有进度回调 → 走 NDJSON 流式；仅当传输层不支持（无 body）时才回退单发。
  if (onProgress) {
    try {
      return await deriveGraphStream(url, goal, signal, onProgress);
    } catch (e) {
      if (!(e instanceof Error) || e.message !== NO_STREAM) throw e; // 真实错误：直接抛
      // 否则落到下面单发 JSON
    }
  }
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
  if (!res.ok)
    throw new Error(hostedErrorMessage(data.error) || String(data.error || tStatic("err.httpStatus", { status: res.status })));
  const points = data.points;
  if (!Array.isArray(points) || points.length === 0) throw new Error(tStatic("err.noPoints"));
  return {
    goal: String(data.goal ?? goal),
    title: String(data.title ?? "").trim() || undefined,
    points: normalize(points),
  };
}

// 流式倒推：按行读 NDJSON，phase/blueprint/module 事件 → onProgress，末行 {"t":"done",...} → 图谱。
// 兼容老后端（忽略 Accept、直接回整张图 JSON）：识别「有 points 无 t」的行当作最终图。
async function deriveGraphStream(
  url: string,
  goal: string,
  signal: AbortSignal | undefined,
  onProgress: (p: DeriveProgress) => void,
): Promise<DerivedGraph> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { ...llmHeaders(), Accept: "application/x-ndjson" },
      body: JSON.stringify({ goal, lang: outputLang() }),
      signal,
    });
  } catch {
    throw new Error(tStatic("err.cantReachDerive"));
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    throw new Error(hostedErrorMessage(data.error) || String(data.error || tStatic("err.httpStatus", { status: res.status })));
  }
  if (!res.body) throw new Error(NO_STREAM); // 环境不支持流式读 → 回退单发
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let result: DerivedGraph | null = null;
  let total = 0;

  const handle = (line: string) => {
    const s = line.trim();
    if (!s) return;
    let ev: Record<string, unknown>;
    try {
      ev = JSON.parse(s) as Record<string, unknown>;
    } catch {
      return; // 半行/噪声：忽略
    }
    const t = ev.t as string | undefined;
    if (t === "phase") {
      onProgress({ phase: (ev.phase as DeriveProgress["phase"]) || "search" });
    } else if (t === "blueprint") {
      total = Number(ev.total) || (Array.isArray(ev.modules) ? (ev.modules as unknown[]).length : 0);
      onProgress({ phase: "expand", modulesTotal: total, modulesDone: 0, modules: (ev.modules as DeriveProgress["modules"]) || [] });
    } else if (t === "module") {
      onProgress({ phase: "expand", modulesTotal: Number(ev.total) || total, modulesDone: Number(ev.done) || 0, doneId: String(ev.id ?? "") });
    } else if (t === "error") {
      throw new Error(hostedErrorMessage(ev.message) || String(ev.message || tStatic("err.deriveFailedShort")));
    } else if (t === "graph") {
      // 装配好的可用图（critique 前）：上报给上层早跳地图，但不终止流（继续读 critique → done）。
      const pts = ev.points;
      if (Array.isArray(pts) && pts.length) {
        onProgress({
          phase: "assembled",
          graph: { goal: String(ev.goal ?? goal), title: String(ev.title ?? "").trim() || undefined, points: normalize(pts) },
        });
      }
    } else if (t === "done" || (Array.isArray(ev.points) && !t)) {
      const pts = ev.points;
      if (Array.isArray(pts) && pts.length) {
        result = { goal: String(ev.goal ?? goal), title: String(ev.title ?? "").trim() || undefined, points: normalize(pts) };
      }
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (value) {
      buf += dec.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        handle(buf.slice(0, nl));
        buf = buf.slice(nl + 1);
      }
    }
    if (done) break;
  }
  if (buf.trim()) handle(buf); // 收尾残行
  if (!result) throw new Error(NO_STREAM); // 没收到终态 → 回退单发
  return result;
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

// 微课后处理（worker 与直连共用）：剥选项序号前缀 + 规整资源。
function finalizeLesson(data: Record<string, unknown>): Lesson {
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

export async function generateLesson(
  input: { name: string; domain?: string; prereqs?: string[]; goal?: string },
  signal?: AbortSignal,
): Promise<Lesson> {
  if (directMode()) {
    const data = await lessonDirect(input, outputLang(), directCfg(), signal);
    return finalizeLesson(data as Record<string, unknown>);
  }
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
  if (!res.ok)
    throw new Error(hostedErrorMessage(data.error) || String(data.error || tStatic("err.httpStatus", { status: res.status })));
  return finalizeLesson(data);
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
  if (!goal.trim()) return "";
  if (directMode()) {
    try {
      return await titleDirect(goal, outputLang(), directCfg());
    } catch {
      return "";
    }
  }
  const url = getTitleUrl();
  if (!url) return "";
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

function finalizeProbes(data: Record<string, unknown>): Record<string, Probe> {
  const probes = data.probes as Record<string, Probe> | undefined;
  if (!probes || !Object.keys(probes).length) throw new Error(tStatic("err.probeEmpty"));
  for (const k of Object.keys(probes)) probes[k].options = (probes[k].options || []).map(stripOptionLabel);
  return probes;
}

export async function generateProbes(
  points: { id: string; name: string; domain?: string }[],
  goal: string,
  signal?: AbortSignal,
): Promise<Record<string, Probe>> {
  if (directMode()) {
    const data = await probesDirect(points, goal, outputLang(), directCfg(), signal);
    return finalizeProbes(data as Record<string, unknown>);
  }
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
  if (!res.ok)
    throw new Error(hostedErrorMessage(data.error) || String(data.error || tStatic("err.httpStatus", { status: res.status })));
  return finalizeProbes(data);
}
