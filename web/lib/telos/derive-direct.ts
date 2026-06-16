// 浏览器直连倒推（真·BYOK）——绕过被墙的 Cloudflare Worker。
//
// 背景：线上倒推端点是 `*.workers.dev`，被 GFW 屏蔽（中国网络打不通，连接挂起而非快速失败）；
// 而用户自带的 LLM/检索 provider（DeepSeek / Tavily）可直连且允许浏览器 CORS。
// 所以当用户配置了自己的 key 时，前端直接调用 provider，不再经任何代理。key 只发往用户自己的 provider。
//
// 本文件是 `workers/derive.js` 编排逻辑的**第三处镜像**（前两处：core/telos_core/llm.py、workers/derive.js）。
// 三段式层级倒推：蓝图 → 并行展开模块 → 汇编/断环。改编排请三处同步。
"use client";

import type { DeriveProgress } from "./derive"; // 仅类型（运行时擦除）→ 与 derive.ts 无循环依赖

// 直连配置：base 已由调用方（derive.ts）规整为合法 URL 或 undefined；这里给默认 DeepSeek。
export interface DirectCfg {
  key?: string;
  base?: string;
  model?: string;
  searchProvider?: string;
  searchKey?: string;
}

type Json = Record<string, unknown>;
const str = (v: unknown): string => (v == null ? "" : String(v));
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

function baseOf(cfg: DirectCfg): string {
  return (cfg.base && cfg.base.trim() ? cfg.base.trim() : "https://api.deepseek.com").replace(/\/+$/, "");
}
function modelOf(cfg: DirectCfg): string {
  return cfg.model && cfg.model.trim() ? cfg.model.trim() : "deepseek-v4-pro";
}

// 直连 LLM（OpenAI 兼容 /chat/completions）。key 缺失→NO_KEY；401/403→NO_KEY（让上层提示填 key）。
async function chatJSON(
  system: string,
  user: string,
  cfg: DirectCfg,
  temperature = 0.2,
  signal?: AbortSignal,
): Promise<Json> {
  const key = (cfg.key || "").trim();
  if (!key) throw new Error("NO_KEY");
  const model = modelOf(cfg);
  const resp = await fetch(baseOf(cfg) + "/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature,
      stream: false,
      response_format: { type: "json_object" },
      // DeepSeek V4 默认思考模式；倒推/微课/诊断要快速结构化 JSON → 关思考（仅 v4 加此字段）。
      ...(/v4/i.test(model) ? { thinking: { type: "disabled" } } : {}),
    }),
    signal,
  });
  if (resp.status === 401 || resp.status === 403) throw new Error("NO_KEY");
  if (!resp.ok) throw new Error(`LLM 请求失败 HTTP ${resp.status}（检查 key / base_url / model）`);
  const data = (await resp.json()) as Json;
  const choices = data.choices as Array<{ message?: { content?: unknown } }> | undefined;
  const content = choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM 返回为空");
  return JSON.parse(str(content)) as Json;
}

// 纯文本直连（概括标题用）。失败/未配 → ""。
async function chatText(system: string, user: string, cfg: DirectCfg, maxTokens = 40): Promise<string> {
  const key = (cfg.key || "").trim();
  if (!key) return "";
  const model = modelOf(cfg);
  try {
    const resp = await fetch(baseOf(cfg) + "/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.3,
        stream: false,
        max_tokens: maxTokens,
        ...(/v4/i.test(model) ? { thinking: { type: "disabled" } } : {}),
      }),
    });
    if (!resp.ok) return "";
    const data = (await resp.json()) as Json;
    const choices = data.choices as Array<{ message?: { content?: unknown } }> | undefined;
    return str(choices?.[0]?.message?.content).trim();
  } catch {
    return "";
  }
}

// ===== prompts（与 workers/derive.js 逐字一致，改一处改三处）=====

function langDirective(lang: string): string {
  lang = String(lang || "").trim();
  if (!lang) return "";
  return (
    `\n\n【输出语言】所有面向学习者的自然语言文本（名称 name / 描述 desc / 讲解 / 选项 / 题干 / ` +
    `解析 / 资源名 等）必须用 ${lang} 书写；JSON 的字段名(key)与枚举值(如 domain、kind)保持英文不变。`
  );
}

const SYSTEM =
  "你是一位精通刻意练习(deliberate practice)、胜任力框架(EPA/CEFR/ACS)与逆向设计的世界级教练。" +
  "给定一个目标，你倒推出达成它真正需要的【可训练能力】——不是知识点清单。" +
  "每个能力都可观测、可练习、有量化达标线，并标注前置依赖形成有向无环图(DAG)。只输出 JSON。";

const USER = (goal: string): string =>
  `目标：${goal}\n\n` +
  "先判断主导学习类型 domain：A=陈述记忆 / B=良构程序(数学/编程) / C=创造(写作/设计) / " +
  "D=动作技能(乐器/运动/手法) / E=开放对抗(竞技体育/电竞/辩论/商战) / F=习惯养成。" +
  "然后把目标倒推成 10-16 个【可训练能力节点】，输出严格 JSON：\n" +
  '{"title":"把目标概括成的简洁标题","points":[{"id":"slug","name":"能做到的事(动宾短语)","prerequisites":["前置id"],"is_goal":false,"minutes":40,"domain":"E","desc":"can-do：在什么条件下能做到什么、到什么标准","drill":"怎么刻意练习(具体方法/反馈来源/如何逐步加难)","benchmark":"一个可量化或可观测的达标线(分新手/进阶/精英更好)"}]}\n' +
  "硬性要求(违反就重写该节点)：\n" +
  "0) title：把目标概括成一个简洁的【主题标题】，像课程名，用于导航栏显示——中文≤12字、英文≤4词；提炼核心主题，绝不照抄整句目标、不要带『我想/学会/达到…水平』这类口语。\n" +
  "1) 节点是【能力/可练单元】，不是知识名词。name 用动宾短语(如『把补刀稳定到14分钟120刀』)；禁止『了解/熟悉/理解X基础/综合能力/心理素质/基础操作』这类泛泛、不可观测的节点。\n" +
  "2) 每个节点必须：可观测(能在一段录像/一局/一份作品里看见)、可练习(能设计反复做且渐进加难的 drill)、有完成标准(benchmark 给量化或行为达标线)。\n" +
  "3) 每个节点要体现『高手与新手在这件事上的差距具体是什么数字/行为』——靠 benchmark 说清。\n" +
  "4) 按 domain 调整 drill/benchmark：E 对抗/D 动作→节点是带『动态对手/资源/时间压力』情境的可练技能，drill 用复盘(VOD)/陪练(scrim)/专项训练，benchmark 用表现数据；C 创造→作品 + rubric 维度；A/B→应用层能力(非死记)。对抗/创造类至少 1/3 高层节点考『新局面下的临场决策/迁移』。\n" +
  "5) id 为唯一英文 slug；prerequisites 只引用本列表 id 且不成环；由易到难分层；恰有一个 is_goal=true 的终点；minutes 为预计投入分钟数。只输出 JSON，不要解释。";

const BLUEPRINT_SYSTEM =
  "你是精通逆向课程设计(backward design)、胜任力框架(CEFR/Bloom/EPA)与知识空间理论的总架构师。" +
  "给定目标，你先判断它的广度，再把它倒推成一份有序的【模块/阶段大纲】(像一门课的章节路线图)，" +
  "为后续逐模块展开可训练能力搭好骨架。模块要把这门学习【完整覆盖】、相邻模块递进。只输出 JSON。";

const BLUEPRINT_USER = (goal: string): string =>
  `目标：${goal}\n\n` +
  "第一步，判断广度档位 scope 并据此定模块数：\n" +
  "- narrow 很窄的单项技能(如『练好CSGO准星拉枪』)→ 3-5 个模块、每模块 4-6 个能力\n" +
  "- skill 一项成形技能/一个单元(如『入门React』『人像布光』)→ 5-7 个模块、每模块 6-8 个\n" +
  "- course 一门课/较完整能力(如『半马完赛』『写出可发表短篇』)→ 6-8 个模块、每模块 7-9 个\n" +
  "- subject 一门学科/大领域(如『掌握机器学习』『精通哈利波特研究』)→ 7-9 个模块、每模块 8-10 个\n\n" +
  "第二步，把目标倒推成有序模块(由基础到综合)，并给出终点目标节点。严格输出 JSON：\n" +
  '{"title":"简洁主题标题(导航用,中文≤12字/英文≤4词,提炼核心、不照抄整句)","domain":"主导学习类型A-F(A陈述记忆/B良构程序/C创造/D动作/E对抗/F习惯)","scope":"narrow|skill|course|subject","modules":[{"id":"英文slug","title":"模块名(名词短语)","summary":"这个模块覆盖什么(一句话)","target":本模块能力数,"order":1}],"goal":{"id":"英文slug","name":"终点能力(动宾短语,即目标本身)","domain":"E","desc":"can-do：在什么条件下能做到什么、到什么标准","drill":"怎么综合演练","benchmark":"量化达标线(分新手/进阶/精英)","module":"它所属的最后一个模块id"}}\n' +
  "要求：1)模块数与 target 按 scope 选，总能力数 ~15(窄)到 ~75(学科)；2)模块覆盖完整(基础/核心/进阶/综合/实战等关键阶段不缺)、相邻递进；3)模块是『阶段/主题』而非单个能力；goal 是整门学习的综合产出(像 EPA：能独立完成的真实任务)；4)id 唯一英文 slug。只输出 JSON。";

const MODULE_SYSTEM =
  "你是精通刻意练习(deliberate practice)与胜任力分解的世界级教练。给定一门学习的某个模块，" +
  "你把它展开成若干【可训练能力节点】——每个都可观测、可反复练习且能渐进加难、有量化达标线，" +
  "是『能做到的事』而不是知识名词。只输出 JSON。";

const MODULE_USER = (
  goal: string,
  modlist: string,
  goalName: string,
  mid: string,
  mtitle: string,
  msum: string,
  target: number,
): string =>
  `总目标：${goal}\n这门学习的全部模块(顺序)：${modlist}\n终点产出：${goalName}\n\n` +
  `现在只展开这一个模块：【${mid}】${mtitle} —— ${msum}\n` +
  `把它展开成约 ${target} 个可训练能力节点，严格输出 JSON：\n` +
  '{"nodes":[{"id":"模块内唯一英文slug","name":"能做到的事(动宾短语,用Bloom动词)","domain":"A-F","minutes":40,"desc":"can-do：在什么条件下能做到什么、到什么标准","drill":"怎么刻意练习(方法/反馈来源/如何加难)","benchmark":"量化或可观测达标线(分新手/进阶/精英更好)","prereq_ids":["本模块内更基础节点的id"],"prereq_hints":["需要先掌握但属于其它模块的能力(用自然语言短语,不要编id)"]}]}\n' +
  "硬性要求：1)节点是能力/可练单元，name 用动宾短语(如『把补刀稳定到14分钟120刀』)；禁止『了解/熟悉/理解X基础/综合能力/心理素质』这类不可观测的词。2)每个节点可观测、能设计反复且渐进加难的 drill、benchmark 给量化或行为达标线(体现高手与新手差距)。3)按 domain 调整：E对抗/D动作→带动态对手/时间压力的情境技能、drill用复盘(VOD)/陪练、benchmark用表现数据；C创造→作品+rubric维度；A/B→在新情境中运用而非死记。4)prereq_ids 只引用本模块内 id；跨模块前置写进 prereq_hints(自然语言)。由易到难。只输出 JSON。";

// ===== 汇编用纯逻辑（移植自 derive.js）=====

interface WorkNode {
  id: string;
  name: string;
  domain: string;
  minutes: number;
  desc: string;
  drill: string;
  benchmark: string;
  module: string;
  moduleTitle: string;
  prereqs: string[];
  isGoal: boolean;
  _pids?: string[];
  _hints?: string[];
}

export interface RawPoint {
  id: string;
  name: string;
  prereqs: string[];
  is_goal: boolean;
  minutes: number;
  domain: string;
  desc: string;
  drill: string;
  benchmark: string;
  module: string;
  moduleTitle: string;
}

// 注意：JS 的 \w 不含 CJK，必须用 \p{L}\p{N}+u flag，否则中文名会被清空 → 去重/匹配失效。
function nrm(s: unknown): string {
  return String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}
function bigrams(s: string): string[] {
  const a: string[] = [];
  for (let i = 0; i < s.length - 1; i++) a.push(s.slice(i, i + 2));
  return s.length >= 2 ? a : s ? [s] : [];
}
function cleanNode(n: WorkNode): RawPoint {
  return {
    id: n.id,
    name: n.name,
    prereqs: n.prereqs,
    is_goal: n.isGoal,
    minutes: n.minutes,
    domain: n.domain,
    desc: n.desc,
    drill: n.drill,
    benchmark: n.benchmark,
    module: n.module,
    moduleTitle: n.moduleTitle,
  };
}
function breakCycles(nodes: Record<string, WorkNode>): void {
  function findBack(): [string, string] | null {
    const color: Record<string, number> = {};
    for (const g in nodes) color[g] = 0;
    let res: [string, string] | null = null;
    function dfs(u: string): boolean {
      color[u] = 1;
      for (const v of nodes[u].prereqs.slice()) {
        if (!nodes[v]) continue;
        if (color[v] === 1) {
          res = [u, v];
          return true;
        }
        if (color[v] === 0 && dfs(v)) return true;
      }
      color[u] = 2;
      return false;
    }
    for (const g in nodes) if (color[g] === 0 && dfs(g)) return res;
    return null;
  }
  for (let i = 0; i < 5000; i++) {
    const be = findBack();
    if (!be) break;
    const idx = nodes[be[0]].prereqs.indexOf(be[1]);
    if (idx >= 0) nodes[be[0]].prereqs.splice(idx, 1);
  }
}
function capNodes(nodes: Record<string, WorkNode>, goalGid: string, limit: number): void {
  while (Object.keys(nodes).length > limit) {
    const hasDep = new Set<string>();
    for (const g in nodes) for (const p of nodes[g].prereqs) hasDep.add(p);
    const cands = Object.keys(nodes).filter((g) => g !== goalGid && !hasDep.has(g) && !nodes[g].isGoal);
    if (!cands.length) break;
    cands.sort((a, b) => nodes[b].prereqs.length - nodes[a].prereqs.length || (a < b ? -1 : 1));
    const drop = cands[0];
    delete nodes[drop];
    for (const g in nodes) {
      const i = nodes[g].prereqs.indexOf(drop);
      if (i >= 0) nodes[g].prereqs.splice(i, 1);
    }
  }
}

interface Module {
  id: string;
  title?: string;
  summary?: string;
  target?: number;
  order?: number;
  domain?: string;
}
interface Blueprint {
  title?: string;
  domain?: string;
  scope?: string;
  modules: Module[];
  goal?: Json;
}

async function blueprint(goal: string, ctx: string, cfg: DirectCfg, lang: string, signal?: AbortSignal): Promise<Blueprint> {
  const spec = (await chatJSON(BLUEPRINT_SYSTEM, BLUEPRINT_USER(goal) + ctx + langDirective(lang), cfg, 0.2, signal)) as Json;
  const rawMods = arr(spec.modules).filter(
    (m) => m && typeof m === "object" && str((m as Json).id).trim() && str((m as Json).title).trim(),
  ) as Json[];
  if (rawMods.length < 2) throw new Error("蓝图模块过少");
  const seen = new Set<string>();
  const clean: Module[] = [];
  rawMods.slice(0, 9).forEach((m, i) => {
    const mid = str(m.id).trim();
    if (seen.has(mid)) return;
    seen.add(mid);
    const o = parseInt(str(m.order), 10);
    clean.push({
      id: mid,
      title: str(m.title),
      summary: str(m.summary),
      target: parseInt(str(m.target), 10),
      order: Number.isFinite(o) ? o : i + 1,
      domain: str(m.domain) || undefined,
    });
  });
  return {
    title: str(spec.title),
    domain: str(spec.domain) || undefined,
    scope: str(spec.scope) || undefined,
    modules: clean,
    goal: (spec.goal as Json) || {},
  };
}

async function expandModule(goal: string, bp: Blueprint, module: Module, cfg: DirectCfg, lang: string, signal?: AbortSignal): Promise<Json[]> {
  let target = Number(module.target);
  if (!Number.isFinite(target)) target = 8;
  target = Math.max(4, Math.min(target, 12));
  const modlist = bp.modules.map((m) => str(m.title)).join("、");
  const gj = (bp.goal ?? {}) as Json;
  const goalName = str(gj.name || goal);
  const user =
    MODULE_USER(goal, modlist, goalName, str(module.id), str(module.title), str(module.summary), target) +
    langDirective(lang);
  const spec = (await chatJSON(MODULE_SYSTEM, user, cfg, 0.3, signal)) as Json;
  return arr(spec.nodes) as Json[];
}

async function parallelExpand(
  goal: string,
  bp: Blueprint,
  cfg: DirectCfg,
  lang: string,
  signal?: AbortSignal,
  onProgress?: (p: DeriveProgress) => void,
): Promise<Record<string, Json[]>> {
  const out: Record<string, Json[]> = {};
  const total = bp.modules.length;
  let done = 0;
  await Promise.all(
    bp.modules.map(async (m) => {
      try {
        out[m.id] = await expandModule(goal, bp, m, cfg, lang, signal);
      } catch {
        out[m.id] = [];
      }
      done++;
      onProgress?.({ phase: "expand", modulesTotal: total, modulesDone: done, doneId: String(m.id) });
    }),
  );
  return out;
}

function assemble(goal: string, bp: Blueprint, expansions: Record<string, Json[]>): { title: string; points: RawPoint[] } {
  const mods = bp.modules.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  const orderOf: Record<string, number> = {};
  mods.forEach((m, i) => (orderOf[m.id] = i));
  const nodes: Record<string, WorkNode> = {};
  const nameIndex: Record<string, string> = {};
  const remap: Record<string, string> = {};
  const modNodes: Record<string, string[]> = {};
  mods.forEach((m) => (modNodes[m.id] = []));

  for (const m of mods) {
    const mid = m.id;
    const mtitle = str(m.title);
    for (const raw of expansions[mid] || []) {
      if (!raw || typeof raw !== "object") continue;
      const lid = str(raw.id).trim() || nrm(raw.name).slice(0, 24);
      const name = str(raw.name || lid).trim();
      if (!lid || !name) continue;
      let gid = `${mid}.${lid}`;
      if (nodes[gid]) gid = `${gid}~${Object.keys(nodes).length}`;
      const nm = nrm(name);
      if (nm && nameIndex[nm]) {
        remap[gid] = nameIndex[nm];
        continue;
      }
      let mins = parseInt(str(raw.minutes), 10);
      if (!Number.isFinite(mins)) mins = 30;
      mins = Math.max(5, Math.min(mins, 180));
      nodes[gid] = {
        id: gid,
        name,
        domain: str(raw.domain || m.domain || bp.domain || "B"),
        minutes: mins,
        desc: str(raw.desc).trim().replace(/^\s*can-?do\s*[:：]\s*/i, ""),
        drill: str(raw.drill).trim(),
        benchmark: str(raw.benchmark).trim(),
        module: mid,
        moduleTitle: mtitle,
        _pids: arr(raw.prereq_ids).map((x) => str(x).trim()).filter(Boolean).map((x) => `${mid}.${x}`),
        _hints: arr(raw.prereq_hints).map((x) => str(x).trim()).filter(Boolean),
        isGoal: false,
        prereqs: [],
      };
      if (nm) nameIndex[nm] = gid;
      modNodes[mid].push(gid);
    }
  }

  const gspec = (bp.goal || {}) as Json;
  let gmid = str(gspec.module).trim();
  if (!(gmid in orderOf)) gmid = mods[mods.length - 1].id;
  let ggid = `${gmid}.${str(gspec.id).trim() || "goal"}`;
  while (nodes[ggid]) ggid += "_g";
  const gmNode = mods.find((m) => m.id === gmid);
  const gmtitle = str(gmNode?.title);
  nodes[ggid] = {
    id: ggid,
    name: str(gspec.name || goal).trim(),
    domain: str(gspec.domain || bp.domain || "B"),
    minutes: 45,
    desc: str(gspec.desc).trim().replace(/^\s*can-?do\s*[:：]\s*/i, ""),
    drill: str(gspec.drill).trim(),
    benchmark: str(gspec.benchmark).trim(),
    module: gmid,
    moduleTitle: gmtitle,
    _pids: [],
    _hints: [],
    isGoal: true,
    prereqs: [],
  };
  (modNodes[gmid] = modNodes[gmid] || []).push(ggid);

  const fix = (ids: string[]): string[] => {
    const out: string[] = [];
    for (let x of ids) {
      x = remap[x] || x;
      if (nodes[x] && !out.includes(x)) out.push(x);
    }
    return out;
  };
  for (const gid of Object.keys(nodes)) nodes[gid].prereqs = fix(nodes[gid]._pids || []);

  // 跨模块 hint → 真边（名字 bigram 重合度，阈值 0.5）
  const nameNorm: Record<string, string> = {};
  for (const gid of Object.keys(nodes)) nameNorm[gid] = nrm(nodes[gid].name);
  for (const gid of Object.keys(nodes)) {
    const n = nodes[gid];
    for (const hint of n._hints || []) {
      const h = nrm(hint);
      if (h.length < 2) continue;
      const hb = new Set(bigrams(h));
      let best: string | null = null;
      let bestScore = 0;
      for (const cand of Object.keys(nodes)) {
        if (cand === gid || nodes[cand].module === n.module) continue;
        const cnm = nameNorm[cand];
        if (!cnm) continue;
        let score: number;
        if (h.includes(cnm) || cnm.includes(h)) score = Math.min(h.length, cnm.length) / Math.max(h.length, cnm.length);
        else {
          const cb = new Set(bigrams(cnm));
          let inter = 0;
          for (const x of hb) if (cb.has(x)) inter++;
          const uni = new Set([...hb, ...cb]).size;
          score = uni ? inter / uni : 0;
        }
        if (score > bestScore) {
          best = cand;
          bestScore = score;
        }
      }
      if (best && bestScore >= 0.5 && !n.prereqs.includes(best)) n.prereqs.push(best);
    }
  }

  const rep: Record<string, string> = {};
  for (const m of mods) {
    const members = (modNodes[m.id] || []).filter((g) => !nodes[g].isGoal);
    if (members.length) rep[m.id] = members[members.length - 1];
  }
  for (const m of mods) {
    const idx = orderOf[m.id];
    if (idx === 0) continue;
    const prev = rep[mods[idx - 1].id];
    if (!prev) continue;
    for (const gid of modNodes[m.id] || []) {
      if (!nodes[gid].isGoal && nodes[gid].prereqs.length === 0) nodes[gid].prereqs = [prev];
    }
  }

  const hasDep = new Set<string>();
  for (const gid of Object.keys(nodes)) for (const p of nodes[gid].prereqs) hasDep.add(p);
  const lastMembers = (modNodes[gmid] || []).filter((g) => g !== ggid);
  const lastSinks = lastMembers.filter((g) => !hasDep.has(g));
  let gpre = fix(lastSinks.length ? lastSinks : lastMembers);
  if (!gpre.length) gpre = mods.map((m) => rep[m.id]).filter((r) => r && r !== ggid);
  nodes[ggid].prereqs = gpre.filter((p) => p !== ggid);

  breakCycles(nodes);
  capNodes(nodes, ggid, 82);

  const points: RawPoint[] = [];
  const seenIds = new Set<string>();
  for (const m of mods)
    for (const gid of modNodes[m.id] || [])
      if (nodes[gid] && !seenIds.has(gid)) {
        points.push(cleanNode(nodes[gid]));
        seenIds.add(gid);
      }
  for (const gid of Object.keys(nodes))
    if (!seenIds.has(gid)) {
      points.push(cleanNode(nodes[gid]));
      seenIds.add(gid);
    }
  return { title: str(bp.title).trim(), points };
}

// 回退：单发倒推（老逻辑），产 ~10-16 节点。
async function deriveSingleSpec(goal: string, ctx: string, cfg: DirectCfg, lang: string, signal?: AbortSignal): Promise<Json> {
  return await chatJSON(SYSTEM, USER(goal) + ctx + langDirective(lang), cfg, 0.2, signal);
}

// LLM 返回 → 校验 DAG（前置存在、无环）→ 规整 points（snake_case 容错）。
function toGraph(spec: Json, goal: string): { goal: string; title: string; points: RawPoint[] } {
  const pts = Array.isArray(spec.points) ? (spec.points as Json[]) : null;
  if (!pts || !pts.length) throw new Error("LLM 返回缺少 points 字段");
  const ids = new Set(pts.map((p) => str(p.id)));
  const VALID_DOMAINS = new Set(["A", "B", "C", "D", "E", "F"]);
  const norm: RawPoint[] = pts.map((p) => {
    const dom = str(p.domain ?? p.domainClass ?? "B").trim().toUpperCase();
    return {
      id: str(p.id),
      name: str(p.name ?? p.id),
      prereqs: arr(p.prerequisites ?? p.prereqs)
        .map(str)
        .filter((x) => ids.has(x) && x !== str(p.id)),
      is_goal: Boolean(p.is_goal ?? p.isGoal ?? false),
      minutes: Number(p.minutes ?? 25) || 25,
      domain: VALID_DOMAINS.has(dom) ? dom : "B",
      desc: str(p.desc).trim(),
      drill: str(p.drill).trim(),
      benchmark: str(p.benchmark).trim(),
      module: str(p.module).trim(),
      moduleTitle: str(p.moduleTitle ?? p.module_title).trim(),
    };
  });
  // 无环校验（Kahn 拓扑排序）
  const indeg: Record<string, number> = {};
  const deps: Record<string, string[]> = {};
  for (const p of norm) {
    indeg[p.id] = p.prereqs.length;
    for (const pre of p.prereqs) (deps[pre] = deps[pre] || []).push(p.id);
  }
  const q = norm.filter((p) => indeg[p.id] === 0).map((p) => p.id);
  let seen = 0;
  while (q.length) {
    const x = q.shift() as string;
    seen++;
    for (const d of deps[x] || []) if (--indeg[d] === 0) q.push(d);
  }
  if (seen !== norm.length) throw new Error("LLM 返回的图谱有环");
  const title = str(spec.title).trim().slice(0, 40);
  return { goal, title, points: norm };
}

// ===== 联网检索（直连用户的 provider）=====

function searchConfig(cfg: DirectCfg): { provider: string; key: string } {
  const provider = str(cfg.searchProvider || "none").trim().toLowerCase();
  let key = str(cfg.searchKey).trim();
  if (key.startsWith("your") || ["", "changeme", "tvly-your-key-here"].includes(key)) key = "";
  return { provider, key };
}
function domainOf(url: string): string {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h.startsWith("www.") ? h.slice(4) : h;
  } catch {
    return "";
  }
}
interface SearchHit {
  title: string;
  url: string;
  snippet: string;
  domain: string;
}
async function searchTavily(query: string, key: string, k: number): Promise<SearchHit[]> {
  const resp = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: key, query, max_results: Math.max(1, Math.min(k, 8)), search_depth: "basic" }),
  });
  if (!resp.ok) return [];
  const data = (await resp.json()) as Json;
  return arr(data.results)
    .slice(0, k)
    .map((r) => {
      const rr = r as Json;
      return {
        title: str(rr.title).trim(),
        url: str(rr.url).trim(),
        snippet: str(rr.content).trim().slice(0, 200),
        domain: domainOf(str(rr.url)),
      };
    })
    .filter((r) => r.title && r.url);
}
async function searchYoutube(query: string, key: string, k: number): Promise<SearchHit[]> {
  const qs = new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video",
    maxResults: String(Math.max(1, Math.min(k, 8))),
    key,
    relevanceLanguage: "zh",
    safeSearch: "moderate",
  });
  const resp = await fetch("https://www.googleapis.com/youtube/v3/search?" + qs);
  if (!resp.ok) return [];
  const data = (await resp.json()) as Json;
  return arr(data.items)
    .map((it) => {
      const i = it as Json;
      const id = i.id as Json | undefined;
      const sn = i.snippet as Json | undefined;
      return { videoId: id?.videoId as string | undefined, title: str(sn?.title).trim(), desc: str(sn?.description).trim().slice(0, 200) };
    })
    .filter((r) => r.videoId && r.title)
    .map((r) => ({ title: r.title, url: `https://www.youtube.com/watch?v=${r.videoId}`, snippet: r.desc, domain: "youtube.com" }));
}
async function webSearch(query: string, cfg: DirectCfg, k = 5): Promise<SearchHit[]> {
  const { provider, key } = searchConfig(cfg);
  if (!key || provider === "none" || provider === "") return [];
  try {
    if (provider === "tavily") return await searchTavily(query, key, k);
    if (provider === "youtube") return await searchYoutube(query, key, k);
  } catch {
    return [];
  }
  return [];
}
async function deriveContext(goal: string, cfg: DirectCfg): Promise<string> {
  const src = await webSearch(`${goal} 学习路径 课程大纲 入门`, cfg, 4);
  if (!src.length) return "";
  const lines = src.map((s) => `- ${s.title}（${s.domain}）${s.snippet ? "：" + s.snippet.slice(0, 70) : ""}`).join("\n");
  return (
    "\n\n【联网参考资料（仅作背景）】以下为检索到的真实课程/资料标题与摘要——" +
    "据此让能力节点更贴合主流学习路径与真实术语；务必提炼为【可训练能力】，不要照抄标题、不要堆知识点：\n" +
    lines
  );
}

// ===== 对外：倒推 / 微课 / 诊断 / 标题（直连版）=====

// ===== 对抗式专家审查 + 自动修补 =====
// 倒推后让"该领域最挑剔的同行专家"挑硬伤并给可执行修订，提升图谱准确度。
// 非破坏：审查失败/把图改崩(丢了目标或节点过少) → 回退原图。仍是同族模型，有相关盲区——这是便宜的一道闸，不是终极验证。
const CRITIQUE_SYSTEM =
  "你是该领域最挑剔的资深从业者 + 课程同行评审。给你一张『从目标倒推出的可训练能力图谱』，" +
  "你要像审稿一样挑出它的硬伤并给出【可执行的修订】——判断依据是真实领域实践，不是表面通顺；只改真问题，不为改而改。只输出 JSON。";
const CRITIQUE_USER = (goal: string, list: string): string =>
  `目标：${goal}\n当前能力图谱（id ｜ 能力名 ｜ 类型 ｜ 前置 ｜ 达标线）：\n${list}\n\n` +
  "按真实领域实践审查，输出严格 JSON（只列需要改的，没问题就给空数组）：\n" +
  '{"renames":[{"id":"","name":"改写成可观测的动宾短语"}],"benchmarks":[{"id":"","benchmark":"可量化或可观测的达标线"}],"remove_prereqs":[{"from":"子id","to":"前置id"}],"add_prereqs":[{"from":"子id","to":"前置id"}],"add_nodes":[{"id":"新英文slug","name":"动宾短语","domain":"A-F","module":"所属现有模块id","prereqs":["现有id"],"benchmark":"量化达标线"}],"drop_nodes":["id"],"notes":"一句话总评"}\n' +
  "审查重点：\n" +
  "1) 含糊/不可观测的节点（『了解/熟悉/掌握基础/综合能力/心理素质』）→ renames 改成具体可练可测的能力。\n" +
  "2) 假前置/反向/牵强的依赖 → remove_prereqs；真实必需却漏掉的依赖 → add_prereqs（只用现有 id）。\n" +
  "3) 领域公认必备却缺失的关键能力 → add_nodes（最多 5 个，挂到合适的现有模块、用现有 id 作前置）。\n" +
  "4) 重复/重叠/与目标无关的节点 → drop_nodes（绝不删目标节点）。\n" +
  "5) 达标线不可量化或为空 → benchmarks 补一个量化或行为达标线。\n" +
  "6) 【难度/顺序】两阶段独立生成、未对齐难度——重点修：若某能力明显更高阶（尤其创造/综合/实战类）却前置太少而会过早解锁/排在前面，用 add_prereqs 补齐它真正依赖的【跨阶段】前置（只用现有 id），让难度大体随阶段递增、基础在前、综合在后。\n" +
  "为保证速度：只挑【最严重的少数】问题（renames≤6、benchmarks≤6、prereq 增删合计≤10、add_nodes≤5、drop_nodes≤3），其余即便不完美也别动。\n" +
  "只改真问题，让图更贴近真实领域的能力结构。只输出 JSON。";

// 在 RawPoint[] 上去环（DFS 删回边），保证修补后仍是 DAG（否则 toGraph 会抛）。
function breakCyclesRaw(points: RawPoint[]): void {
  const byId = new Map(points.map((p) => [p.id, p]));
  const findBack = (): [string, string] | null => {
    const color: Record<string, number> = {};
    for (const p of points) color[p.id] = 0;
    let res: [string, string] | null = null;
    const visit = (u: string): boolean => {
      color[u] = 1;
      for (const v of byId.get(u)!.prereqs.slice()) {
        if (!byId.has(v)) continue;
        if (color[v] === 1) {
          res = [u, v];
          return true;
        }
        if (color[v] === 0 && visit(v)) return true;
      }
      color[u] = 2;
      return false;
    };
    for (const p of points) if (color[p.id] === 0 && visit(p.id)) return res;
    return null;
  };
  for (let i = 0; i < 5000; i++) {
    const be = findBack();
    if (!be) break;
    const p = byId.get(be[0])!;
    const idx = p.prereqs.indexOf(be[1]);
    if (idx >= 0) p.prereqs.splice(idx, 1);
  }
}

async function critiqueAndRepair(goal: string, points: RawPoint[], cfg: DirectCfg, lang: string, signal?: AbortSignal): Promise<RawPoint[]> {
  if (points.length < 5) return points;
  const list = points
    .map((p) => `- ${p.id} ｜ ${p.name} ｜ ${p.domain} ｜ 前置[${p.prereqs.join(" ") || "无"}]${p.benchmark ? ` ｜ 达标:${p.benchmark.slice(0, 36)}` : ""}`)
    .join("\n");
  let spec: Json;
  try {
    spec = await chatJSON(CRITIQUE_SYSTEM, CRITIQUE_USER(goal, list) + langDirective(lang), cfg, 0.2, signal);
  } catch {
    return points; // 审查失败 → 原图不动
  }
  const byId = new Map(points.map((p) => [p.id, p]));
  const moduleTitleOf = (mid: string) => points.find((p) => p.module === mid)?.moduleTitle || "";
  const VALID = new Set(["A", "B", "C", "D", "E", "F"]);

  for (const r of arr(spec.renames)) {
    const o = r as Json;
    const p = byId.get(str(o.id));
    const name = str(o.name).trim();
    if (p && name && name.length <= 42) p.name = name;
  }
  for (const b of arr(spec.benchmarks)) {
    const o = b as Json;
    const p = byId.get(str(o.id));
    const bm = str(o.benchmark).trim();
    if (p && bm) p.benchmark = bm;
  }
  for (const e of arr(spec.remove_prereqs)) {
    const o = e as Json;
    const p = byId.get(str(o.from));
    if (p) {
      const i = p.prereqs.indexOf(str(o.to));
      if (i >= 0) p.prereqs.splice(i, 1);
    }
  }
  for (const e of arr(spec.add_prereqs)) {
    const o = e as Json;
    const f = str(o.from);
    const tt = str(o.to);
    const p = byId.get(f);
    if (p && tt !== f && byId.has(tt) && !p.prereqs.includes(tt)) p.prereqs.push(tt);
  }
  const dropCap = Math.max(2, Math.floor(points.length * 0.15));
  const toDrop = new Set<string>();
  for (const d of arr(spec.drop_nodes)) {
    const p = byId.get(str(d));
    if (p && !p.is_goal && toDrop.size < dropCap) toDrop.add(p.id);
  }
  const added: RawPoint[] = [];
  for (const n of arr(spec.add_nodes).slice(0, 5)) {
    const o = n as Json;
    const id = str(o.id).trim();
    const name = str(o.name).trim();
    if (!id || !name || byId.has(id) || added.some((a) => a.id === id) || toDrop.has(id)) continue;
    const dom = str(o.domain || "B").trim().toUpperCase();
    const mid = str(o.module).trim();
    added.push({
      id,
      name,
      prereqs: arr(o.prereqs).map(str).filter((x) => byId.has(x)),
      is_goal: false,
      minutes: 30,
      domain: VALID.has(dom) ? dom : "B",
      desc: str(o.desc).trim(),
      drill: str(o.drill).trim(),
      benchmark: str(o.benchmark).trim(),
      module: mid,
      moduleTitle: moduleTitleOf(mid),
    });
  }

  const result = points.filter((p) => !toDrop.has(p.id)).concat(added);
  const live = new Set(result.map((p) => p.id));
  for (const p of result) p.prereqs = p.prereqs.filter((x) => live.has(x) && x !== p.id);
  breakCyclesRaw(result);
  // 保险：改崩了（丢了目标 / 节点过少）→ 回退原图
  if (!result.some((p) => p.is_goal) && points.some((p) => p.is_goal)) return points;
  if (result.length < Math.min(6, points.length)) return points;
  return result;
}

export async function deriveDirect(
  goal: string,
  lang: string,
  cfg: DirectCfg,
  signal?: AbortSignal,
  onProgress?: (p: DeriveProgress) => void,
): Promise<{ goal: string; title: string; points: RawPoint[] }> {
  if (!(cfg.key || "").trim()) throw new Error("NO_KEY");
  onProgress?.({ phase: "search" });
  const ctx = await deriveContext(goal, cfg);
  let title = "";
  let points: RawPoint[] | null = null;
  try {
    onProgress?.({ phase: "blueprint" });
    const bp = await blueprint(goal, ctx, cfg, lang, signal);
    const mods = bp.modules || [];
    onProgress?.({
      phase: "expand",
      modulesTotal: mods.length,
      modulesDone: 0,
      modules: mods.map((m) => ({ id: String(m.id), title: String(m.title || "") })),
    });
    const expansions = await parallelExpand(goal, bp, cfg, lang, signal, onProgress);
    const total = Object.values(expansions).reduce((s, a) => s + a.length, 0);
    if (total >= 6) {
      onProgress?.({ phase: "assemble" });
      const cand = assemble(goal, bp, expansions);
      if (cand.points.length >= 6) {
        points = cand.points;
        title = cand.title;
      }
    }
  } catch {
    points = null;
  }
  if (!points) {
    onProgress?.({ phase: "single" });
    const g = toGraph(await deriveSingleSpec(goal, ctx, cfg, lang, signal), goal);
    points = g.points;
    title = g.title;
  }
  // 对抗式专家审查 + 自动修补（非破坏：失败/改崩则回退）
  try {
    onProgress?.({ phase: "critique" });
    points = await critiqueAndRepair(goal, points, cfg, lang, signal);
  } catch {
    /* keep */
  }
  return toGraph({ title, points } as unknown as Json, goal);
}

export async function titleDirect(goal: string, lang: string, cfg: DirectCfg): Promise<string> {
  if (!goal.trim()) return "";
  const TITLE_SYSTEM =
    "你把学习目标概括成一个简洁的【主题标题】，像课程名。只输出标题本身，不要引号、不要标点结尾、不要解释。";
  const user =
    `把下面的学习目标概括成一个简洁标题：中文≤12字、英文≤4词；提炼核心主题，去掉『我想/学会/达到…水平』这类口语。只输出标题。\n目标：${goal}` +
    langDirective(lang);
  let tt = await chatText(TITLE_SYSTEM, user, cfg);
  tt = tt.replace(/^["“「]+|["”」]+$/g, "").split("\n")[0].slice(0, 40);
  return tt;
}

// ---- 微课（直连）----

const LESSON_SYSTEM =
  "你是一位精通认知科学的微课设计师。针对单个知识点，设计一节【交互式、能真正学会】的微课——" +
  "靠『让学习者动手、预测、补全、检索』来建构理解，而不是堆砌讲解文字。" +
  "遵循：预测先行 → 直觉讲解 → 分步范例 → 自我解释 → 渐隐填空 → 无脚手架检索(掌握闸门)；" +
  "答错给【提示阶梯】，逐步逼近但绝不直接给答案。只输出 JSON。";
const LESSON_STEPS_JSON =
  "设计一节交互式微课，严格输出如下 JSON（steps 必须正好按此 6 步顺序、kind 用英文小写）：\n" +
  '{"concept":"一句话点出核心要义/高手的关键认知","steps":[' +
  '{"kind":"predict","prompt":"讲解前先抛出的核心问题，让学习者先猜（低风险、不计分）","options":["..4 项.."],"answer":0,"reveal":"揭示正确项并一句话点出为何"},' +
  '{"kind":"explain","text":"≤160 字、建立直觉的讲解，点出高手与新手的关键差别","analogy":"用已掌握的前置打贴切类比（无则用生活常识）"},' +
  '{"kind":"worked","problem":"带具体情境/数字、能照着做一遍的真实范例","steps":[{"do":"做什么","why":"为什么/关键点"}]},' +
  '{"kind":"self_explain","prompt":"针对范例某一步问『为什么这样做』","options":["..4 项.."],"answer":0,"rationale":"为什么对"},' +
  '{"kind":"faded","problem":"同类型新题","given":["已写好的前几步"],"prompt":"最后一步该怎么做？","options":["..4 项.."],"answer":0,"hints":["提示1:方向","提示2:更具体","提示3:几乎点破"],"rationale":"为什么"},' +
  '{"kind":"retrieve","prompt":"全新、无脚手架的应用/情境判断题（掌握闸门）","options":["..4 项.."],"answer":0,"hints":["提示1","提示2"],"rationale":"为什么对、其它为何错"}],';
const LESSON_REQS =
  "硬性要求：每题恰 4 选项、answer 为正确项下标(0-3)、唯一正确。\n" +
  "【选项铁律·杜绝凭语气猜答案——违反就重写该题】(a)四个选项长度相近、句式一致、具体度与语气同样专业笃定：严禁正解更长/更全/更稳妥，严禁错项更绝对/更草率/更外行；(b)禁止『中庸即答案』——不要把正解设成两极端之间那个折中/平衡项，不要『严格按X / 完全无视X / 折中一下』这种一眼挑中间的结构；(c)对错必须取决于本知识点的一个硬事实/原理/阈值/操作步骤，使『没学过此点但很会做题』的聪明人仅凭选项措辞无法判断、命中率≈瞎猜(25%)；(d)干扰项＝持某种貌似在行却错误的心智模型的进阶者会真心选的【本领域具体误区】(用本领域术语、说得自信)，禁止『问别人/查资料/多练练』这类放之四海的万能错项与明显荒谬项；(e)去掉一切措辞线索(不靠『可能/适当/建议』对『必须/一定/绝不』的软硬对比暴露答案)；(f)定稿前自检『一个完全不懂此主题的应试高手，能否仅凭选项写法挑出正解？』——能则推翻重写。\n" +
  "worked.steps 给 3-5 步(每步 do+why)；faded 是完成式问题(given 写好前几步、留空最后一步)，hints 提示阶梯 2-3 条由浅入深、最后一条几乎点破但不给答案；retrieve 无脚手架作为掌握闸门；" +
  "按 domain 调整：A 记忆=例子/助记；B 程序=可分步范例；C 创造=范例+rubric；D 动作=分解练习+达标；E 对抗=情境拆解+决策；F 习惯=触发-行为-奖励；";
const LESSON_USER = (name: string, domain: string, prereqs: string[], goal: string): string => {
  const head = `知识点：${name}\n所属目标：${goal}\n学习类型(domain)：${domain}\n学习者已掌握的前置：${
    prereqs.length ? prereqs.join("、") : "（无）"
  }\n\n`;
  return (
    head +
    LESSON_STEPS_JSON +
    '"resources":[{"name":"真实存在、口碑最好的公开课/视频名","platform":"YouTube/B站/Coursera/官方文档"}]}\n' +
    LESSON_REQS +
    "resources 给 2-3 个真实存在、口碑最好的优质学习资源，至少包含 1 个视频公开课(YouTube/B站/Coursera/中国大学MOOC 等)；只写课程/视频名+平台，绝不编造 URL。只输出 JSON。"
  );
};

interface LessonResourceRaw {
  name: string;
  platform?: string;
  url?: string;
  domain?: string;
  snippet?: string;
}
function resolveResources(spec: Json): LessonResourceRaw[] {
  const out: LessonResourceRaw[] = [];
  const seen = new Set<string>();
  for (const r of (Array.isArray(spec.resources) ? (spec.resources as Json[]) : []).slice(0, 6)) {
    if (!r || typeof r !== "object") continue;
    const name = str(r.name).trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push({ name, platform: str(r.platform).trim() });
    if (out.length >= 3) break;
  }
  return out;
}
async function searchResources(topic: string, cfg: DirectCfg, k = 2): Promise<LessonResourceRaw[]> {
  const out: LessonResourceRaw[] = [];
  for (const s of await webSearch(`${topic} 教程 公开课`.trim(), cfg, 4)) {
    out.push({ name: str(s.title).slice(0, 60), url: s.url, domain: s.domain || "", platform: s.domain || "", snippet: s.snippet || "" });
    if (out.length >= k) break;
  }
  return out;
}
function mergeResources(real: LessonResourceRaw[], suggested: LessonResourceRaw[]): LessonResourceRaw[] {
  const out: LessonResourceRaw[] = [];
  const seen = new Set<string>();
  for (const r of [...real, ...suggested]) {
    const dom = (r.domain || "").trim();
    const key = (r.url || "").trim() || r.name || "";
    if (seen.has(key) || (dom && seen.has(dom))) continue;
    seen.add(key);
    if (dom) seen.add(dom);
    out.push(r);
    if (out.length >= 4) break;
  }
  return out;
}

// 返回 worker /lesson 等价的原始对象 {concept, steps, resources}；steps 的后处理交给 derive.ts 统一做。
export async function lessonDirect(
  input: { name: string; domain?: string; prereqs?: string[]; goal?: string },
  lang: string,
  cfg: DirectCfg,
  signal?: AbortSignal,
): Promise<Json> {
  const name = (input.name || "").trim();
  if (!name) throw new Error("name 不能为空");
  const prereqs = (input.prereqs || []).map(String);
  const goal = str(input.goal);
  const spec = (await chatJSON(
    LESSON_SYSTEM,
    LESSON_USER(name, str(input.domain || "B"), prereqs, goal) + langDirective(lang),
    cfg,
    0.3,
    signal,
  )) as Json;
  const resources = resolveResources(spec);
  // Tavily 增强（可选）：真实直达链接前置
  const topic = (goal ? goal + " " : "") + name;
  let finalResources = resources;
  try {
    const real = await searchResources(topic, cfg);
    if (real.length) finalResources = mergeResources(real, resources);
  } catch {
    /* 检索失败 → 用 LLM 建议 */
  }
  return { concept: str(spec.concept).trim(), steps: arr(spec.steps), resources: finalResources };
}

// ---- 诊断题（直连）----

const PROBES_SYSTEM =
  "你是一位顶尖的测评专家。你出的诊断题考【应用/分析/决策】而非记忆，对错只取决于真实的专业知识，" +
  "绝不能让人靠选项的语气/长短/稳妥程度猜出答案；四个选项同质，每个错误选项都对应一种真实存在的高水平误解——" +
  "持似是而非错误心智模型的进阶者会被带偏，真专家不会。只输出 JSON。";
const PROBES_USER = (items: string, goal: string): string =>
  `目标：${goal}\n知识点列表(id ｜ 名称 ｜ 类型)：\n${items}\n\n` +
  '为每个 id 出一道有区分度的诊断题，输出严格 JSON：\n{"probes":{"<id>":{"q":"题干","options":["A","B","C","D"],"answer":0,"rationale":"为何对，及每个错项对应哪种误解"}}}\n' +
  "硬性要求（违反就重写该题）：\n" +
  "1) 考高阶(应用/分析/决策)：给具体情境/数据/条件，问最优判断或下一步；E对抗/D动作类出情境判断题(含对手/资源/时间压力)。禁止纯背定义，禁止『最重要的是/最该先做什么』这类有安全答案的送分题。\n" +
  "2) 【同质选项·杜绝套路】四个选项长度相近、句式一致、具体度与语气同样专业笃定：严禁正解更长/更全/更稳妥，严禁错项更绝对/更草率/更外行。禁止『中庸即答案』——不要把正解设成两极端之间那个折中/平衡项。\n" +
  "3) 【靠硬知识定胜负】对错必须取决于一个明确的专业事实/原理/阈值/操作步骤，使『没学过此点但很会做题』的聪明人仅凭选项措辞无法判断、命中率≈瞎猜(25%)；去掉『可能/适当』对『必须/绝不』这类软硬措辞线索。\n" +
  "4) 干扰项＝本领域【真实的高手级误区】(如『过度求稳放弃节奏』『只看自家数据忽视全局』)：是持某种貌似在行却错误的心智模型的进阶者会真心选的，用本领域术语说得专业自信；禁止『问同伴/查资料/多练习』这类放之四海的万能错项与明显荒谬项。\n" +
  "5) 自检：定稿前自问『一个完全不懂此主题的应试高手，能否仅凭选项写法挑出正解？』能则推翻重写。\n" +
  "6) 恰 4 个选项、answer 为正确项下标(0-3)、唯一正确答案；键必须用给定 id。只输出 JSON。";

// 返回 worker /probe 等价的 {probes}；选项 stripOptionLabel 交给 derive.ts 统一做。
export async function probesDirect(
  points: { id: string; name: string; domain?: string }[],
  goal: string,
  lang: string,
  cfg: DirectCfg,
  signal?: AbortSignal,
): Promise<Json> {
  if (!points.length) throw new Error("points 不能为空");
  const items = points.map((p) => `- ${p.id} ｜ ${p.name || p.id} ｜ ${p.domain || "B"}`).join("\n");
  const ctx = await deriveContext(goal, cfg);
  const spec = (await chatJSON(PROBES_SYSTEM, PROBES_USER(items, goal) + ctx + langDirective(lang), cfg, 0.3, signal)) as Json;
  const raw = spec.probes as Json | undefined;
  if (!raw || typeof raw !== "object") throw new Error("诊断题返回缺少 probes");
  const out: Record<string, { q: string; options: string[]; answer: number; rationale: string }> = {};
  for (const [pid, qv] of Object.entries(raw)) {
    const q = qv as Json;
    if (!q || typeof q !== "object") continue;
    const options = arr(q.options).map(str).filter((o) => o.trim());
    if (!str(q.q).trim() || options.length < 2) continue;
    let ans = parseInt(str(q.answer), 10);
    if (!Number.isFinite(ans)) ans = 0;
    out[pid] = { q: str(q.q).trim(), options, answer: Math.max(0, Math.min(ans, options.length - 1)), rationale: str(q.rationale).trim() };
  }
  if (!Object.keys(out).length) throw new Error("没有可用的诊断题");
  return { probes: out };
}

// 直连可达性测试：极小 LLM 调用（max_tokens 省成本）。返回是否 ok + 是否 key 有效。
export async function testDirect(cfg: DirectCfg): Promise<{ reachable: boolean; keyOk: boolean; model: string }> {
  const key = (cfg.key || "").trim();
  const model = modelOf(cfg);
  if (!key) return { reachable: true, keyOk: false, model };
  try {
    const resp = await fetch(baseOf(cfg) + "/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 1,
        stream: false,
        ...(/v4/i.test(model) ? { thinking: { type: "disabled" } } : {}),
      }),
    });
    return { reachable: true, keyOk: resp.ok, model };
  } catch {
    return { reachable: false, keyOk: false, model };
  }
}
