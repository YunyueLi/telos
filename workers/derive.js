// Telos 倒推代理 —— Cloudflare Worker 版（给公开网页用）。
//
// 与 core/telos_core/llm.py 等价：目标 → 前置知识 DAG。
// API key 存 Worker secret（TELOS_LLM_API_KEY），永远在服务端，绝不进前端代码。
//
// 部署见 ../DERIVE.md。本文件零依赖，OpenAI 兼容，默认 DeepSeek。

// prompt（倒推 / 微课 / 诊断）抽到 ./prompts.js（公开 baseline）；owner 私有增强见 prompts.private.js + deploy.sh。
import {
  SYSTEM, USER, BLUEPRINT_SYSTEM, BLUEPRINT_USER, MODULE_SYSTEM, MODULE_USER,
  CRITIQUE_SYSTEM, CRITIQUE_USER, TITLE_SYSTEM, LESSON_SYSTEM, LESSON_STEPS_JSON,
  LESSON_REQS, STYLE_RULES, LESSON_USER, PROBES_SYSTEM, PROBES_USER,
} from "./prompts.js";

// 输出语言指令（#7 i18n）：让生成的面向学习者文本用指定语言；JSON 键名保持英文。缺省不限定。
function langDirective(lang) {
  lang = String(lang || "").trim();
  if (!lang) return "";
  return (
    `\n\n【输出语言】所有面向学习者的自然语言文本（名称 name / 描述 desc / 讲解 / 选项 / 题干 / ` +
    `解析 / 资源名 等）必须用 ${lang} 书写；JSON 的字段名(key)与枚举值(如 domain、kind)保持英文不变。`
  );
}

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOW_ORIGIN || "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    // BYOK：放行调用方随请求携带的自有 key / base / model / 检索配置。
    "Access-Control-Allow-Headers":
      "Content-Type, X-Telos-Key, X-Telos-Base, X-Telos-Model, X-Telos-Search-Key, X-Telos-Search-Provider",
    "Access-Control-Max-Age": "86400",
  };
}

// BYOK：用调用方请求头里的自有配置覆盖服务端 env（env 仅作站长自用回退）。key 不落盘、不记录。
function effectiveEnv(env, request) {
  const h = request.headers;
  const pick = (hdr, key) => {
    const v = h.get(hdr);
    return v && v.trim() ? v.trim() : env[key];
  };
  return {
    ...env,
    TELOS_LLM_API_KEY: pick("X-Telos-Key", "TELOS_LLM_API_KEY"),
    TELOS_LLM_BASE_URL: pick("X-Telos-Base", "TELOS_LLM_BASE_URL"),
    TELOS_LLM_MODEL: pick("X-Telos-Model", "TELOS_LLM_MODEL"),
    TELOS_SEARCH_API_KEY: pick("X-Telos-Search-Key", "TELOS_SEARCH_API_KEY"),
    TELOS_SEARCH_PROVIDER: pick("X-Telos-Search-Provider", "TELOS_SEARCH_PROVIDER"),
  };
}

function json(data, status, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(env) },
  });
}

// LLM 返回 → 前端 engine.ts 能直接吃的形状（prereqs / isGoal 驼峰），并校验是 DAG、前置存在、无环。
function toGraph(spec, goal) {
  const points = spec && Array.isArray(spec.points) ? spec.points : null;
  if (!points || !points.length) throw new Error("LLM 返回缺少 points 字段");
  const ids = new Set(points.map((p) => String(p.id)));
  const VALID_DOMAINS = new Set(["A", "B", "C", "D", "E", "F"]);
  const norm = points.map((p) => {
    const dom = String(p.domain ?? p.domainClass ?? "B").trim().toUpperCase();
    return {
      id: String(p.id),
      name: String(p.name ?? p.id),
      prereqs: (p.prerequisites ?? p.prereqs ?? [])
        .map(String)
        .filter((x) => ids.has(x) && x !== String(p.id)),
      isGoal: Boolean(p.is_goal ?? p.isGoal ?? false),
      minutes: Number(p.minutes ?? 25) || 25,
      domain: VALID_DOMAINS.has(dom) ? dom : "B",
      desc: String(p.desc ?? "").trim(),
      drill: String(p.drill ?? "").trim(),
      benchmark: String(p.benchmark ?? "").trim(),
      module: String(p.module ?? "").trim(),
      moduleTitle: String(p.moduleTitle ?? p.module_title ?? "").trim(),
    };
  });
  // 无环校验（Kahn 拓扑排序）
  const indeg = {};
  const deps = {};
  for (const p of norm) {
    indeg[p.id] = p.prereqs.length;
    for (const pre of p.prereqs) (deps[pre] = deps[pre] || []).push(p.id);
  }
  const q = norm.filter((p) => indeg[p.id] === 0).map((p) => p.id);
  let seen = 0;
  while (q.length) {
    const x = q.shift();
    seen++;
    for (const d of deps[x] || []) if (--indeg[d] === 0) q.push(d);
  }
  if (seen !== norm.length) throw new Error("LLM 返回的图谱有环");
  const title = String(spec.title ?? "").trim().slice(0, 40);
  return { goal, title, points: norm };
}

// 倒推前联网检索真实课程/路径作背景，让能力图谱更贴合主流学习路径与真实术语。未配/出错→''。
async function deriveContext(goal, env) {
  const src = await webSearch(`${goal} 学习路径 课程大纲 入门`, env, 4);
  if (!src.length) return "";
  const lines = src.map((s) => `- ${s.title}（${s.domain}）${s.snippet ? "：" + s.snippet.slice(0, 70) : ""}`).join("\n");
  return (
    "\n\n【联网参考资料（仅作背景）】以下为检索到的真实课程/资料标题与摘要——" +
    "据此让能力节点更贴合主流学习路径与真实术语；务必提炼为【可训练能力】，不要照抄标题、不要堆知识点：\n" + lines
  );
}

// ===== 层级化倒推（多段 + 并行 fan-out）——镜像 core/telos_core/llm.py =====
// 单发 LLM 只产 10-16 节点、易截断、无层级 → 框架稀疏。改为「蓝图→并行模块展开→合并/断环」。

async function chatJSON(system, user, env, temperature = 0.2) {
  const key = env.TELOS_LLM_API_KEY;
  const base = (env.TELOS_LLM_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
  const model = env.TELOS_LLM_MODEL || "deepseek-v4-pro";
  const resp = await fetch(base + "/chat/completions", {
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
      // DeepSeek V4 双模、思考为默认；倒推/微课/诊断要快速结构化 JSON → 一律非思考（仅 v4 加此字段）。
      ...(/v4/i.test(model) ? { thinking: { type: "disabled" } } : {}),
    }),
  });
  if (!resp.ok) throw new Error(`LLM 请求失败 HTTP ${resp.status}（检查 key / base_url / model）`);
  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM 返回为空");
  return JSON.parse(content);
}

// 注意：JS 的 \w 不含 CJK，必须用 \p{L}\p{N}+u flag，否则中文名会被清空 → 去重/匹配失效。
function nrm(s) {
  return String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}
function bigrams(s) {
  const a = [];
  for (let i = 0; i < s.length - 1; i++) a.push(s.slice(i, i + 2));
  return s.length >= 2 ? a : s ? [s] : [];
}
function cleanNode(n) {
  return {
    id: n.id, name: n.name, prereqs: n.prereqs, is_goal: n.isGoal, minutes: n.minutes,
    domain: n.domain, desc: n.desc, drill: n.drill, benchmark: n.benchmark, module: n.module, moduleTitle: n.moduleTitle,
  };
}
function breakCycles(nodes) {
  function findBack() {
    const color = {};
    for (const g in nodes) color[g] = 0;
    let res = null;
    function dfs(u) {
      color[u] = 1;
      for (const v of nodes[u].prereqs.slice()) {
        if (!nodes[v]) continue;
        if (color[v] === 1) { res = [u, v]; return true; }
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
function capNodes(nodes, goalGid, limit) {
  while (Object.keys(nodes).length > limit) {
    const hasDep = new Set();
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

async function blueprint(goal, ctx, env, lang) {
  const spec = await chatJSON(BLUEPRINT_SYSTEM, BLUEPRINT_USER(goal) + ctx + langDirective(lang), env, 0.2);
  let mods = Array.isArray(spec?.modules)
    ? spec.modules.filter((m) => m && String(m.id || "").trim() && String(m.title || "").trim())
    : [];
  if (mods.length < 2) throw new Error("蓝图模块过少");
  const seen = new Set();
  const clean = [];
  mods.slice(0, 9).forEach((m, i) => {
    const mid = String(m.id).trim();
    if (seen.has(mid)) return;
    seen.add(mid);
    m.id = mid;
    const o = parseInt(m.order, 10);
    m.order = Number.isFinite(o) ? o : i + 1;
    clean.push(m);
  });
  spec.modules = clean;
  return spec;
}

async function expandModule(goal, bp, module, env, lang) {
  let target = parseInt(module.target, 10);
  if (!Number.isFinite(target)) target = 8;
  target = Math.max(4, Math.min(target, 12));
  const modlist = bp.modules.map((m) => String(m.title || "")).join("、");
  const goalName = String((bp.goal || {}).name || goal);
  const user =
    MODULE_USER(goal, modlist, goalName, String(module.id), String(module.title || ""), String(module.summary || ""), target) +
    langDirective(lang);
  const spec = await chatJSON(MODULE_SYSTEM, user, env, 0.3);
  return Array.isArray(spec?.nodes) ? spec.nodes : [];
}

async function parallelExpand(goal, bp, env, lang, emit) {
  const out = {};
  const total = bp.modules.length;
  let done = 0;
  await Promise.all(
    bp.modules.map(async (m) => {
      try {
        out[m.id] = await expandModule(goal, bp, m, env, lang);
      } catch {
        out[m.id] = [];
      }
      done++;
      emit?.({ t: "module", id: String(m.id), done, total }); // 每个模块完成即吐真实进度
    }),
  );
  return out;
}

function assemble(goal, bp, expansions) {
  const mods = bp.modules.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  const orderOf = {};
  mods.forEach((m, i) => (orderOf[m.id] = i));
  const nodes = {};
  const nameIndex = {};
  const remap = {};
  const modNodes = {};
  mods.forEach((m) => (modNodes[m.id] = []));

  for (const m of mods) {
    const mid = m.id, mtitle = String(m.title || "");
    for (const raw of expansions[mid] || []) {
      if (!raw || typeof raw !== "object") continue;
      const lid = String(raw.id || "").trim() || nrm(raw.name).slice(0, 24);
      const name = String(raw.name || lid).trim();
      if (!lid || !name) continue;
      let gid = `${mid}.${lid}`;
      if (nodes[gid]) gid = `${gid}~${Object.keys(nodes).length}`;
      const nm = nrm(name);
      if (nm && nameIndex[nm]) { remap[gid] = nameIndex[nm]; continue; }
      let mins = parseInt(raw.minutes, 10);
      if (!Number.isFinite(mins)) mins = 30;
      mins = Math.max(5, Math.min(mins, 180));
      nodes[gid] = {
        id: gid, name,
        domain: String(raw.domain || m.domain || bp.domain || "B"),
        minutes: mins,
        desc: String(raw.desc || "").trim().replace(/^\s*can-?do\s*[:：]\s*/i, ""),
        drill: String(raw.drill || "").trim(),
        benchmark: String(raw.benchmark || "").trim(),
        module: mid, moduleTitle: mtitle,
        _pids: (raw.prereq_ids || []).map((x) => String(x).trim()).filter(Boolean).map((x) => `${mid}.${x}`),
        _hints: (raw.prereq_hints || []).map((x) => String(x).trim()).filter(Boolean),
        isGoal: false,
      };
      if (nm) nameIndex[nm] = gid;
      modNodes[mid].push(gid);
    }
  }

  const gspec = bp.goal || {};
  let gmid = String(gspec.module || "").trim();
  if (!(gmid in orderOf)) gmid = mods[mods.length - 1].id;
  let ggid = `${gmid}.${String(gspec.id || "goal").trim() || "goal"}`;
  while (nodes[ggid]) ggid += "_g";
  const gmtitle = (mods.find((m) => m.id === gmid) || {}).title || "";
  nodes[ggid] = {
    id: ggid, name: String(gspec.name || goal).trim(),
    domain: String(gspec.domain || bp.domain || "B"),
    minutes: 45,
    desc: String(gspec.desc || "").trim().replace(/^\s*can-?do\s*[:：]\s*/i, ""),
    drill: String(gspec.drill || "").trim(),
    benchmark: String(gspec.benchmark || "").trim(),
    module: gmid, moduleTitle: String(gmtitle),
    _pids: [], _hints: [], isGoal: true,
  };
  (modNodes[gmid] = modNodes[gmid] || []).push(ggid);

  const fix = (ids) => {
    const out = [];
    for (let x of ids) {
      x = remap[x] || x;
      if (nodes[x] && !out.includes(x)) out.push(x);
    }
    return out;
  };
  for (const gid of Object.keys(nodes)) nodes[gid].prereqs = fix(nodes[gid]._pids || []);

  // 跨模块 hint → 真边（名字 bigram 重合度，阈值 0.5）
  const nameNorm = {};
  for (const gid of Object.keys(nodes)) nameNorm[gid] = nrm(nodes[gid].name);
  for (const gid of Object.keys(nodes)) {
    const n = nodes[gid];
    for (const hint of n._hints || []) {
      const h = nrm(hint);
      if (h.length < 2) continue;
      const hb = new Set(bigrams(h));
      let best = null, bestScore = 0;
      for (const cand of Object.keys(nodes)) {
        if (cand === gid || nodes[cand].module === n.module) continue;
        const cnm = nameNorm[cand];
        if (!cnm) continue;
        let score;
        if (h.includes(cnm) || cnm.includes(h)) score = Math.min(h.length, cnm.length) / Math.max(h.length, cnm.length);
        else {
          const cb = new Set(bigrams(cnm));
          let inter = 0;
          for (const x of hb) if (cb.has(x)) inter++;
          const uni = new Set([...hb, ...cb]).size;
          score = uni ? inter / uni : 0;
        }
        if (score > bestScore) { best = cand; bestScore = score; }
      }
      if (best && bestScore >= 0.5 && !n.prereqs.includes(best)) n.prereqs.push(best);
    }
  }

  const rep = {};
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

  const hasDep = new Set();
  for (const gid of Object.keys(nodes)) for (const p of nodes[gid].prereqs) hasDep.add(p);
  const lastMembers = (modNodes[gmid] || []).filter((g) => g !== ggid);
  const lastSinks = lastMembers.filter((g) => !hasDep.has(g));
  let gpre = fix(lastSinks.length ? lastSinks : lastMembers);
  if (!gpre.length) gpre = mods.map((m) => rep[m.id]).filter((r) => r && r !== ggid);
  nodes[ggid].prereqs = gpre.filter((p) => p !== ggid);

  breakCycles(nodes);
  capNodes(nodes, ggid, 82);

  const points = [];
  const seen = new Set();
  for (const m of mods) for (const gid of modNodes[m.id] || []) if (nodes[gid] && !seen.has(gid)) { points.push(cleanNode(nodes[gid])); seen.add(gid); }
  for (const gid of Object.keys(nodes)) if (!seen.has(gid)) { points.push(cleanNode(nodes[gid])); seen.add(gid); }
  return { title: String(bp.title || "").trim(), points };
}

// 回退：单发倒推（老逻辑），产 ~10-16 节点。
async function deriveSingleSpec(goal, ctx, env, lang) {
  return await chatJSON(SYSTEM, USER(goal) + ctx + langDirective(lang), env, 0.2);
}

// ===== 对抗式专家审查 + 自动修补（镜像 derive-direct.ts）=====

function breakCyclesRaw(points) {
  const byId = new Map(points.map((p) => [p.id, p]));
  const findBack = () => {
    const color = {};
    for (const p of points) color[p.id] = 0;
    let res = null;
    const visit = (u) => {
      color[u] = 1;
      const node = byId.get(u);
      for (const v of node.prereqs.slice()) {
        if (!byId.has(v)) continue;
        if (color[v] === 1) { res = [u, v]; return true; }
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
    const p = byId.get(be[0]);
    const idx = p.prereqs.indexOf(be[1]);
    if (idx >= 0) p.prereqs.splice(idx, 1);
  }
}

async function critiqueAndRepair(goal, points, env, lang) {
  if (points.length < 5) return points;
  const list = points
    .map((p) => `- ${p.id} ｜ ${p.name} ｜ ${p.domain} ｜ 前置[${p.prereqs.join(" ") || "无"}]${p.benchmark ? ` ｜ 达标:${String(p.benchmark).slice(0, 36)}` : ""}`)
    .join("\n");
  let spec;
  try {
    spec = await chatJSON(CRITIQUE_SYSTEM, CRITIQUE_USER(goal, list) + langDirective(lang), env, 0.2);
  } catch {
    return points;
  }
  const arr = (v) => (Array.isArray(v) ? v : []);
  const byId = new Map(points.map((p) => [p.id, p]));
  const moduleTitleOf = (mid) => (points.find((p) => p.module === mid) || {}).moduleTitle || "";
  const VALID = new Set(["A", "B", "C", "D", "E", "F"]);
  for (const r of arr(spec.renames)) {
    const p = byId.get(String(r.id));
    const name = String(r.name || "").trim();
    if (p && name && name.length <= 42) p.name = name;
  }
  for (const b of arr(spec.benchmarks)) {
    const p = byId.get(String(b.id));
    const bm = String(b.benchmark || "").trim();
    if (p && bm) p.benchmark = bm;
  }
  for (const e of arr(spec.remove_prereqs)) {
    const p = byId.get(String(e.from));
    if (p) { const i = p.prereqs.indexOf(String(e.to)); if (i >= 0) p.prereqs.splice(i, 1); }
  }
  for (const e of arr(spec.add_prereqs)) {
    const f = String(e.from), tt = String(e.to);
    const p = byId.get(f);
    if (p && tt !== f && byId.has(tt) && !p.prereqs.includes(tt)) p.prereqs.push(tt);
  }
  const dropCap = Math.max(2, Math.floor(points.length * 0.15));
  const toDrop = new Set();
  for (const d of arr(spec.drop_nodes)) {
    const p = byId.get(String(d));
    if (p && !p.is_goal && toDrop.size < dropCap) toDrop.add(p.id);
  }
  const added = [];
  for (const n of arr(spec.add_nodes).slice(0, 5)) {
    const id = String(n.id || "").trim(), name = String(n.name || "").trim();
    if (!id || !name || byId.has(id) || added.some((a) => a.id === id) || toDrop.has(id)) continue;
    const dom = String(n.domain || "B").trim().toUpperCase();
    const mid = String(n.module || "").trim();
    added.push({
      id, name, prereqs: arr(n.prereqs).map(String).filter((x) => byId.has(x)),
      is_goal: false, minutes: 30, domain: VALID.has(dom) ? dom : "B",
      desc: String(n.desc || "").trim(), drill: String(n.drill || "").trim(), benchmark: String(n.benchmark || "").trim(),
      module: mid, moduleTitle: moduleTitleOf(mid),
    });
  }
  const result = points.filter((p) => !toDrop.has(p.id)).concat(added);
  const live = new Set(result.map((p) => p.id));
  for (const p of result) p.prereqs = p.prereqs.filter((x) => live.has(x) && x !== p.id);
  breakCyclesRaw(result);
  if (!result.some((p) => p.is_goal) && points.some((p) => p.is_goal)) return points;
  if (result.length < Math.min(6, points.length)) return points;
  return result;
}

async function derive(goal, env, lang, emit) {
  const ev = (o) => { try { emit?.(o); } catch { /* emit 失败绝不影响倒推 */ } };
  const key = env.TELOS_LLM_API_KEY;
  if (!key) throw new Error("Worker 未配置 TELOS_LLM_API_KEY（用 wrangler secret put 设置）");
  ev({ t: "phase", phase: "search" });
  const ctx = await deriveContext(goal, env);
  let spec = null;
  try {
    ev({ t: "phase", phase: "blueprint" });
    const bp = await blueprint(goal, ctx, env, lang);
    const mods = bp.modules || [];
    ev({ t: "blueprint", total: mods.length, modules: mods.map((m) => ({ id: String(m.id), title: String(m.title || "") })) });
    const expansions = await parallelExpand(goal, bp, env, lang, ev);
    const total = Object.values(expansions).reduce((s, a) => s + a.length, 0);
    if (total >= 6) {
      ev({ t: "phase", phase: "assemble" });
      const cand = assemble(goal, bp, expansions);
      if (cand.points.length >= 6) spec = cand;
    }
  } catch {
    spec = null;
  }
  if (!spec) {
    ev({ t: "phase", phase: "single" });
    spec = await deriveSingleSpec(goal, ctx, env, lang);
  }
  const graph = toGraph(spec, goal);
  // critique 前先把装配好的图吐给前端 → 可早 ~26s 跳地图（校对在后台精修后再 patch）。
  ev({ t: "graph", goal: graph.goal, title: graph.title, points: graph.points });
  try {
    ev({ t: "phase", phase: "critique" });
    graph.points = await critiqueAndRepair(goal, graph.points, env, lang);
  } catch {
    /* 非破坏：审查异常则保留原图 */
  }
  return graph;
}

// 概括标题（给旧项目补标题，轻量纯文本）。失败/未配 → ''（前端回退到原目标）。
async function summarizeTitle(goal, env, lang) {
  const key = env.TELOS_LLM_API_KEY;
  if (!key) return "";
  const base = (env.TELOS_LLM_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
  const model = env.TELOS_LLM_MODEL || "deepseek-v4-pro";
  const user =
    `把下面的学习目标概括成一个简洁标题：中文≤12字、英文≤4词；提炼核心主题，去掉『我想/学会/达到…水平』这类口语。只输出标题。\n目标：${goal}` +
    langDirective(lang);
  try {
    const resp = await fetch(base + "/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "system", content: TITLE_SYSTEM }, { role: "user", content: user }], temperature: 0.3, stream: false, max_tokens: 40, ...(/v4/i.test(model) ? { thinking: { type: "disabled" } } : {}) }),
    });
    if (!resp.ok) return "";
    const data = await resp.json();
    let tt = String(data?.choices?.[0]?.message?.content || "").trim();
    tt = tt.replace(/^["“「]+|["”」]+$/g, "").split("\n")[0].slice(0, 40);
    return tt;
  } catch {
    return "";
  }
}

// ---- 联网检索（agentic grounding）：拿真实来源喂给模型，杜绝模型编造 URL ----
// 默认不联网（优雅降级回平台搜索链接）。配 TELOS_SEARCH_PROVIDER=tavily|youtube + TELOS_SEARCH_API_KEY 启用。

function searchConfig(env) {
  const provider = String(env.TELOS_SEARCH_PROVIDER || "none").trim().toLowerCase();
  let key = String(env.TELOS_SEARCH_API_KEY || "").trim();
  if (key.startsWith("your") || ["", "changeme", "tvly-your-key-here"].includes(key)) key = "";
  return { provider, key };
}

function domainOf(url) {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h.startsWith("www.") ? h.slice(4) : h;
  } catch {
    return "";
  }
}

async function searchTavily(query, key, k) {
  const resp = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: key, query, max_results: Math.max(1, Math.min(k, 8)), search_depth: "basic" }),
  });
  if (!resp.ok) return [];
  const data = await resp.json();
  return (data.results || [])
    .slice(0, k)
    .map((r) => ({
      title: String(r.title || "").trim(),
      url: String(r.url || "").trim(),
      snippet: String(r.content || "").trim().slice(0, 200),
      domain: domainOf(String(r.url || "")),
    }))
    .filter((r) => r.title && r.url);
}

async function searchYoutube(query, key, k) {
  const qs = new URLSearchParams({
    part: "snippet", q: query, type: "video", maxResults: String(Math.max(1, Math.min(k, 8))),
    key, relevanceLanguage: "zh", safeSearch: "moderate",
  });
  const resp = await fetch("https://www.googleapis.com/youtube/v3/search?" + qs);
  if (!resp.ok) return [];
  const data = await resp.json();
  return (data.items || [])
    .map((it) => ({
      videoId: it?.id?.videoId,
      title: String(it?.snippet?.title || "").trim(),
      desc: String(it?.snippet?.description || "").trim().slice(0, 200),
    }))
    .filter((r) => r.videoId && r.title)
    .map((r) => ({ title: r.title, url: `https://www.youtube.com/watch?v=${r.videoId}`, snippet: r.desc, domain: "youtube.com" }));
}

// 返回 [{title,url,snippet,domain}]；未配置/出错 → []（优雅降级，绝不抛错）。
async function webSearch(query, env, k = 5) {
  const { provider, key } = searchConfig(env);
  if (!key || provider === "none" || provider === "") return [];
  try {
    if (provider === "tavily") return await searchTavily(query, key, k);
    if (provider === "youtube") return await searchYoutube(query, key, k);
  } catch {
    return [];
  }
  return [];
}

// ---- 按需微课 ----

// LESSON_USER 等微课 prompt 已抽到 ./prompts.js（公开 baseline）。

function mcqFields(s) {
  const options = (s.options || []).map(String).filter((o) => o.trim());
  if (options.length < 2) return null;
  let answer = parseInt(s.answer, 10);
  if (!Number.isFinite(answer)) answer = 0;
  answer = Math.max(0, Math.min(answer, options.length - 1));
  const hints = (s.hints || []).map((h) => String(h).trim()).filter(Boolean);
  return { options, answer, hints };
}

function toLesson(spec) {
  const out = [];
  for (const s of Array.isArray(spec?.steps) ? spec.steps : []) {
    if (!s || typeof s !== "object") continue;
    const kind = String(s.kind || "").trim();
    if (kind === "explain") {
      const text = String(s.text || "").trim();
      if (text) out.push({ kind, text, analogy: String(s.analogy || "").trim() });
    } else if (kind === "worked") {
      const steps = [];
      for (const w of s.steps || []) {
        if (w && typeof w === "object" && String(w.do || "").trim())
          steps.push({ do: String(w.do).trim(), why: String(w.why || "").trim() });
        else if (String(w || "").trim()) steps.push({ do: String(w).trim(), why: "" });
      }
      if (steps.length) out.push({ kind, problem: String(s.problem || "").trim(), steps });
    } else if (["predict", "self_explain", "faded", "retrieve"].includes(kind)) {
      const m = mcqFields(s);
      if (!m) continue;
      const q = String(s.prompt || s.q || "").trim();
      if (!q) continue;
      const step = { kind, prompt: q, options: m.options, answer: m.answer };
      if (kind === "predict") step.reveal = String(s.reveal || "").trim();
      if (kind === "faded") {
        step.problem = String(s.problem || "").trim();
        step.given = (s.given || []).map((g) => String(g).trim()).filter(Boolean);
      }
      if (["self_explain", "faded", "retrieve"].includes(kind)) step.rationale = String(s.rationale || "").trim();
      if (["faded", "retrieve"].includes(kind)) step.hints = m.hints;
      out.push(step);
    }
  }
  const graded = out.filter((st) => ["retrieve", "faded", "self_explain"].includes(st.kind));
  if (!out.length || !graded.length) throw new Error("微课内容不完整");
  return { concept: String(spec?.concept || "").trim(), steps: out, resources: resolveResources(spec) };
}

// 规整 LLM 建议资源为 [{name, platform}]（最多 3，去重）。前端无真链时回退平台搜索。
function resolveResources(spec) {
  const out = [];
  const seen = new Set();
  for (const r of (Array.isArray(spec?.resources) ? spec.resources : []).slice(0, 6)) {
    if (!r || typeof r !== "object") continue;
    const name = String(r.name || "").trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push({ name, platform: String(r.platform || "").trim() });
    if (out.length >= 3) break;
  }
  return out;
}

// Tavily 命中真实来源 → 真链资源卡（前置增强）。未配/出错→[]。
async function searchResources(topic, env, k = 2) {
  const out = [];
  for (const s of await webSearch(`${topic} 教程 公开课`.trim(), env, 4)) {
    out.push({ name: String(s.title).slice(0, 60), url: s.url, domain: s.domain || "", platform: s.domain || "", snippet: s.snippet || "" });
    if (out.length >= k) break;
  }
  return out;
}

// 真链卡在前 + LLM 建议在后，按 url/域名/名称去重，最多 4。Tavily 是增强、保留 LLM 视频建议。
function mergeResources(real, suggested) {
  const out = [];
  const seen = new Set();
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

async function lesson(body, env) {
  const key = env.TELOS_LLM_API_KEY;
  if (!key) throw new Error("Worker 未配置 TELOS_LLM_API_KEY（用 wrangler secret put 设置）");
  const name = String(body.name || "").trim();
  if (!name) throw new Error("name 不能为空");
  const base = (env.TELOS_LLM_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
  const model = env.TELOS_LLM_MODEL || "deepseek-v4-pro";
  const prereqs = (body.prereqs || []).map(String);
  const goal = String(body.goal || "");
  const resp = await fetch(base + "/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: LESSON_SYSTEM },
        { role: "user", content: LESSON_USER(name, String(body.domain || "B"), prereqs, goal) + langDirective(body.lang) },
      ],
      temperature: 0.3,
      stream: false,
      response_format: { type: "json_object" },
      ...(/v4/i.test(model) ? { thinking: { type: "disabled" } } : {}),
    }),
  });
  if (!resp.ok) throw new Error(`LLM 请求失败 HTTP ${resp.status}（检查 key / base_url / model）`);
  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM 返回为空");
  const out = toLesson(JSON.parse(content));
  // Tavily 增强（可选）：真实直达链接前置到 LLM 建议之前，二者互补；未配则只用 LLM 建议
  const topic = (goal ? goal + " " : "") + name;
  const real = await searchResources(topic, env);
  if (real.length) out.resources = mergeResources(real, out.resources);
  return out;
}

// ---- 起点诊断题（批量） ----


async function probes(body, env) {
  const key = env.TELOS_LLM_API_KEY;
  if (!key) throw new Error("Worker 未配置 TELOS_LLM_API_KEY（用 wrangler secret put 设置）");
  const points = Array.isArray(body.points) ? body.points : [];
  if (!points.length) throw new Error("points 不能为空");
  const base = (env.TELOS_LLM_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
  const model = env.TELOS_LLM_MODEL || "deepseek-v4-pro";
  const items = points.map((p) => `- ${p.id} ｜ ${p.name || p.id} ｜ ${p.domain || "B"}`).join("\n");
  const ctx = await deriveContext(String(body.goal || ""), env);
  const resp = await fetch(base + "/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: PROBES_SYSTEM },
        { role: "user", content: PROBES_USER(items, String(body.goal || "")) + ctx + langDirective(body.lang) },
      ],
      temperature: 0.3,
      stream: false,
      response_format: { type: "json_object" },
      ...(/v4/i.test(model) ? { thinking: { type: "disabled" } } : {}),
    }),
  });
  if (!resp.ok) throw new Error(`LLM 请求失败 HTTP ${resp.status}（检查 key / base_url / model）`);
  const data = await resp.json();
  const spec = JSON.parse(data?.choices?.[0]?.message?.content || "{}");
  const raw = spec.probes;
  if (!raw || typeof raw !== "object") throw new Error("诊断题返回缺少 probes");
  const out = {};
  for (const [pid, q] of Object.entries(raw)) {
    if (!q || typeof q !== "object") continue;
    const options = (q.options || []).map(String).filter((o) => o.trim());
    if (!String(q.q || "").trim() || options.length < 2) continue;
    let ans = parseInt(q.answer, 10);
    if (!Number.isFinite(ans)) ans = 0;
    out[pid] = {
      q: String(q.q).trim(),
      options,
      answer: Math.max(0, Math.min(ans, options.length - 1)),
      rationale: String(q.rationale || "").trim(),
    };
  }
  if (!Object.keys(out).length) throw new Error("没有可用的诊断题");
  return { probes: out };
}

// ════════════════ 托管 AI（开箱即用）：身份 + 配额计量 ════════════════
// 商业模型：BYOK（请求带 X-Telos-Key）→ 直接放行、不计量（用户用自己的 key，我们零成本）；
// 无 BYOK → 「托管模式」：用服务端 key 代为推理，按账号计量——Free 试用(总量) / Pro 月度配额 / 加油包(bonus)。
// 依赖：TELOS_USAGE (KV 绑定) + SUPABASE_ANON_KEY (验 token 用，公开值)。缺任一 → 托管关闭(NO_HOSTED)。
// 计量单位：d=倒推次数（重操作）；l=微课/出题次数（轻操作）。title 不计量（随倒推的小请求）。

function hostedEnabled(env) {
  return !!(env.TELOS_LLM_API_KEY && env.TELOS_USAGE && env.SUPABASE_URL && env.SUPABASE_ANON_KEY);
}

// 验证 Supabase access_token → { id, pro }；无效返回 null。
async function verifyUser(env, token) {
  if (!token) return null;
  try {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const u = await res.json();
    if (!u || !u.id) return null;
    const m = u.app_metadata || {};
    const until = m.telos_pro_until;
    const t = until == null || until === "" ? null : typeof until === "number" ? until : Date.parse(String(until));
    const pro = m.telos_pro === true && (t == null || t > Date.now());
    const templates = Array.isArray(m.telos_templates) ? m.telos_templates.map(String) : [];
    return { id: u.id, pro, templates };
  } catch {
    return null;
  }
}

const monthKey = () => {
  const d = new Date();
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
const readJson = async (kv, key) => {
  try {
    return (await kv.get(key, "json")) || {};
  } catch {
    return {};
  }
};

function hostedQuotas(env) {
  const n = (v, d) => {
    const x = parseInt(String(v ?? ""), 10);
    return Number.isFinite(x) && x >= 0 ? x : d;
  };
  return {
    pro: { d: n(env.HOSTED_PRO_DERIVES, 30), l: n(env.HOSTED_PRO_LESSONS, 600) },
    trial: { d: n(env.HOSTED_TRIAL_DERIVES, 3), l: n(env.HOSTED_TRIAL_LESSONS, 60) },
  };
}

// 托管门禁：unit ∈ "d"|"l"|null(不计量)。通过 → {user, commit()}；拒绝 → {deny: Response}。
async function hostedGate(request, env, unit) {
  if (!hostedEnabled(env)) return { deny: json({ error: "NO_HOSTED" }, 503, env) };
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const user = await verifyUser(env, token);
  if (!user) return { deny: json({ error: "NEED_LOGIN" }, 401, env) };
  if (!unit) return { user, commit: async () => {} };
  const kv = env.TELOS_USAGE;
  const q = hostedQuotas(env);
  const mk = `u:${user.id}:${monthKey()}`;
  const tk = `t:${user.id}`;
  const bk = `b:${user.id}`;
  const [month, trial, bonus] = await Promise.all([readJson(kv, mk), readJson(kv, tk), readJson(kv, bk)]);
  const used = (o) => ({ d: o.d || 0, l: o.l || 0 });
  const m = used(month);
  const t = used(trial);
  const b = used(bonus); // bonus = 剩余可用（充值进、消耗减）
  let commit;
  if (user.pro) {
    if (m[unit] < q.pro[unit]) {
      commit = async () => kv.put(mk, JSON.stringify({ ...m, [unit]: m[unit] + 1 }), { expirationTtl: 60 * 60 * 24 * 62 });
    } else if (b[unit] > 0) {
      commit = async () => kv.put(bk, JSON.stringify({ ...b, [unit]: b[unit] - 1 }));
    } else {
      return { deny: json({ error: "HOSTED_QUOTA", used: m[unit], quota: q.pro[unit] }, 429, env) };
    }
  } else {
    if (t[unit] < q.trial[unit]) {
      commit = async () => kv.put(tk, JSON.stringify({ ...t, [unit]: t[unit] + 1 }));
    } else if (b[unit] > 0) {
      commit = async () => kv.put(bk, JSON.stringify({ ...b, [unit]: b[unit] - 1 }));
    } else {
      return { deny: json({ error: "HOSTED_TRIAL_USED", used: t[unit], quota: q.trial[unit] }, 402, env) };
    }
  }
  return { user, commit };
}

// 用量查询（/billing/usage）：给 /pro 页画用量条。
async function hostedUsage(request, env) {
  if (!hostedEnabled(env)) return json({ error: "NO_HOSTED" }, 503, env);
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const user = await verifyUser(env, token);
  if (!user) return json({ error: "NEED_LOGIN" }, 401, env);
  const kv = env.TELOS_USAGE;
  const q = hostedQuotas(env);
  const [month, trial, bonus] = await Promise.all([
    readJson(kv, `u:${user.id}:${monthKey()}`),
    readJson(kv, `t:${user.id}`),
    readJson(kv, `b:${user.id}`),
  ]);
  return json(
    {
      ok: true,
      pro: user.pro,
      month: { d: month.d || 0, l: month.l || 0 },
      trial: { d: trial.d || 0, l: trial.l || 0 },
      bonus: { d: bonus.d || 0, l: bonus.l || 0 },
      quota: user.pro ? q.pro : q.trial,
    },
    200,
    env,
  );
}

// ════════════════ 付费模板内容下发（/template）════════════════
// 付费图谱的完整内容（desc/drill/benchmark）不进公开前端/仓库——前端只有 meta + 大纲预览。
// 完整 points 存 KV（键 tpl:<id>，owner 用 workers/seed-templates.sh 灌入）。
// 鉴权：已购该模板（app_metadata.telos_templates）或 Pro → 下发；否则 403。免费模板内容仍在前端，不走这里。
async function templateContent(request, env) {
  if (!env.TELOS_USAGE || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return json({ error: "NO_HOSTED" }, 503, env);
  let id = "";
  try {
    const b = await request.json();
    id = String(b.id || "").trim();
  } catch {
    return json({ error: "bad json" }, 400, env);
  }
  if (!/^[a-z0-9-]{1,40}$/.test(id)) return json({ error: "bad id" }, 400, env);
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const user = await verifyUser(env, token);
  if (!user) return json({ error: "NEED_LOGIN" }, 401, env);
  if (!user.pro && !user.templates.includes(id)) return json({ error: "NOT_OWNED" }, 403, env);
  let points = null;
  try {
    points = await env.TELOS_USAGE.get(`tpl:${id}`, "json");
  } catch {
    points = null;
  }
  if (!Array.isArray(points) || !points.length) return json({ error: "NO_TEMPLATE" }, 404, env);
  return json({ id, points }, 200, env);
}

// ════════════════ 完课证书验真（/cert/register · /cert/verify）════════════════
// 领取证书时登录登记（写 KV cert:<serial>），生成可验真链接 /app/cert?no=<serial>；
// 任何人凭编号公开查询真伪 + 证书信息（社交传播素材）。内容永久存 KV，证书不过期。
const CERT_RE = /^TL-[A-Z0-9]{4,16}$/;

async function certRegister(request, env) {
  if (!env.TELOS_USAGE || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return json({ error: "NO_HOSTED" }, 503, env);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad json" }, 400, env);
  }
  const serial = String(body.serial || "").trim();
  if (!CERT_RE.test(serial)) return json({ error: "bad serial" }, 400, env);
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const user = await verifyUser(env, token);
  if (!user) return json({ error: "NEED_LOGIN" }, 401, env);
  const key = `cert:${serial}`;
  const existing = await env.TELOS_USAGE.get(key, "json");
  if (existing) return json({ ok: true, already: true }, 200, env); // 幂等：同一证书已登记
  const rec = {
    name: String(body.name || "").slice(0, 60),
    goal: String(body.goal || "").slice(0, 200),
    nodes: parseInt(String(body.nodes), 10) || 0,
    dateISO: String(body.dateISO || "").slice(0, 30),
    uid: user.id,
    at: Date.now(),
  };
  await env.TELOS_USAGE.put(key, JSON.stringify(rec)); // 永久（证书不过期）
  return json({ ok: true }, 200, env);
}

async function certVerify(url, env) {
  if (!env.TELOS_USAGE) return json({ found: false }, 200, env);
  const serial = String(url.searchParams.get("no") || "").trim();
  if (!CERT_RE.test(serial)) return json({ found: false }, 200, env);
  let rec = null;
  try {
    rec = await env.TELOS_USAGE.get(`cert:${serial}`, "json");
  } catch {
    rec = null;
  }
  if (!rec) return json({ found: false }, 200, env);
  return json({ found: true, serial, name: rec.name, goal: rec.goal, nodes: rec.nodes, dateISO: rec.dateISO }, 200, env);
}

// ════════════════ Telos Pro 计费 webhook ════════════════
// 支付服务商(MoR) → 本端点（验 HMAC 签名）→ 用 service_role 把权益写进 Supabase app_metadata。
// app_metadata 用户不可自改（区别于 user_metadata），前端 billing.ts 读它解锁 Pro。
// 所需 secret（wrangler secret put）：BILLING_WEBHOOK_SECRET / SUPABASE_SERVICE_ROLE_KEY；
// vars：BILLING_PROVIDER=creem|lemonsqueezy、SUPABASE_URL。webhook 由服务商服务器直连，不受 GFW 影响。

async function hmacHex(secret, raw) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEq(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

const ms = (v) => {
  if (v == null || v === "") return null;
  const t = typeof v === "number" ? v : Date.parse(String(v));
  return Number.isFinite(t) ? t : null;
};

// 事件 → 权益变更。返回 { uid, patch } / { uid, pack }（加油包）/ null（无关事件直接 ACK）。
// 加油包 SKU 约定：checkout 链接的 plan 传 `pack_d10`（10 次倒推）/ `pack_l200`（200 次微课）→ 充进 KV bonus。
function billingMapEvent(provider, evt) {
  const okPlan = (p) => (["monthly", "yearly", "lifetime"].includes(p) ? p : null);
  const okPack = (p) => {
    const m = /^pack_([dl])(\d{1,5})$/.exec(p || "");
    return m ? { unit: m[1], n: parseInt(m[2], 10) } : null;
  };
  // 模板店 SKU：tpl_<id>（如 tpl_kaoyan_en）→ 发货 = 把模板 id 并进 app_metadata.telos_templates
  const okTpl = (p) => (/^tpl_[a-z0-9_]{1,40}$/.test(p || "") ? p.slice(4).replace(/_/g, "-") : null);
  if (provider === "lemonsqueezy") {
    const name = evt?.meta?.event_name || "";
    const custom = evt?.meta?.custom_data || {};
    const uid = String(custom.user_id || "").trim();
    const plan = okPlan(String(custom.plan || ""));
    const pack = okPack(String(custom.plan || ""));
    const a = evt?.data?.attributes || {};
    if (!uid) return { uid: "", patch: null, name };
    if (name === "order_created") {
      if (pack) return { uid, name, pack };
      const tpl = okTpl(String(custom.plan || ""));
      if (tpl) return { uid, name, tpl };
      if (plan === "lifetime") return { uid, name, patch: { pro: true, plan, until: null } };
      return null; // 订阅的 order 由 subscription_* 事件负责
    }
    if (name === "order_refunded") return { uid, name, patch: { pro: false, plan: null, until: null } };
    if (name === "subscription_created" || name === "subscription_updated") {
      const st = String(a.status || "");
      if (["active", "on_trial", "past_due"].includes(st))
        return { uid, name, patch: { pro: true, plan, until: ms(a.renews_at) } };
      if (st === "cancelled") return { uid, name, patch: { pro: true, plan, until: ms(a.ends_at) } }; // 已付周期内保留
      if (["expired", "unpaid"].includes(st)) return { uid, name, patch: { pro: false, plan: null, until: null } };
      return null;
    }
    if (name === "subscription_expired") return { uid, name, patch: { pro: false, plan: null, until: null } };
    return null;
  }
  // Creem：事件名形如 checkout.completed / subscription.active|paid|canceled|expired / refund.created
  const name = evt?.eventType || evt?.type || "";
  const obj = evt?.object || {};
  const meta = obj.metadata || obj.subscription?.metadata || obj.order?.metadata || {};
  const uid = String(meta.user_id || "").trim();
  const plan = okPlan(String(meta.plan || ""));
  const pack = okPack(String(meta.plan || ""));
  if (!uid) return { uid: "", patch: null, name };
  const periodEnd = ms(obj.current_period_end_date || obj.subscription?.current_period_end_date);
  if (name === "checkout.completed") {
    if (pack) return { uid, name, pack };
    const tpl = okTpl(String(meta.plan || ""));
    if (tpl) return { uid, name, tpl };
    if (plan === "lifetime") return { uid, name, patch: { pro: true, plan, until: null } };
    return { uid, name, patch: { pro: true, plan, until: periodEnd } }; // 订阅后续由 subscription.* 修正
  }
  if (name === "subscription.active" || name === "subscription.paid" || name === "subscription.update")
    return { uid, name, patch: { pro: true, plan, until: periodEnd } };
  if (name === "subscription.canceled") return { uid, name, patch: { pro: true, plan, until: periodEnd } }; // 已付周期内保留
  if (name === "subscription.expired") return { uid, name, patch: { pro: false, plan: null, until: null } };
  if (name === "refund.created") return { uid, name, patch: { pro: false, plan: null, until: null } };
  return null;
}

// 写 Supabase（GoTrue Admin API；app_metadata 顶层键合并）。
async function billingPatchUser(env, uid, p) {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(uid)}`, {
    method: "PUT",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      app_metadata: {
        telos_pro: p.pro,
        telos_plan: p.plan,
        telos_pro_until: p.until,
        telos_billing_provider: env.BILLING_PROVIDER || "creem",
        telos_billing_at: Date.now(),
      },
    }),
  });
  if (!res.ok) throw new Error(`supabase admin ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

async function billingWebhook(request, env) {
  if (!env.BILLING_WEBHOOK_SECRET || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)
    return json({ error: "billing 未配置（缺 secret/SUPABASE_URL/SERVICE_ROLE）" }, 503, env);
  const raw = await request.text();
  const provider = env.BILLING_PROVIDER || "creem";
  const sigHeader = provider === "lemonsqueezy" ? "X-Signature" : "creem-signature";
  const given = (request.headers.get(sigHeader) || "").trim().toLowerCase();
  const want = await hmacHex(env.BILLING_WEBHOOK_SECRET, raw);
  if (!given || !timingSafeEq(given, want)) return json({ error: "bad signature" }, 401, env);
  let evt;
  try {
    evt = JSON.parse(raw);
  } catch {
    return json({ error: "bad json" }, 400, env);
  }
  const r = billingMapEvent(provider, evt);
  if (!r) return json({ ok: true, skip: true }, 200, env); // 无关事件：直接 ACK
  if (!r.uid || (!r.patch && !r.pack && !r.tpl)) {
    // 缺 user_id（如买家没经过我们带参的链接）：ACK 但记录，避免服务商无限重试
    console.warn("[billing] event without user_id:", r.name);
    return json({ ok: true, skip: "no user_id" }, 200, env);
  }
  try {
    if (r.tpl) {
      // 模板发货：读现有 telos_templates → 合并 → 写回（app_metadata 顶层键整体替换，须先读）
      const ures = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(r.uid)}`, {
        headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
      });
      if (!ures.ok) throw new Error(`admin get ${ures.status}`);
      const u = await ures.json();
      const cur = Array.isArray(u?.app_metadata?.telos_templates) ? u.app_metadata.telos_templates : [];
      const next = cur.includes(r.tpl) ? cur : [...cur, r.tpl];
      const pres = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(r.uid)}`, {
        method: "PUT",
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ app_metadata: { telos_templates: next } }),
      });
      if (!pres.ok) throw new Error(`admin put ${pres.status}`);
      console.info("[billing]", r.name, "→", r.uid.slice(0, 8), `tpl ${r.tpl}`);
      return json({ ok: true }, 200, env);
    }
    if (r.pack) {
      // 加油包：充进 KV bonus（托管配额余额）。无 KV 绑定时记录并 ACK（不可重试修复，须人工补）。
      if (!env.TELOS_USAGE) {
        console.error("[billing] pack purchased but TELOS_USAGE KV missing:", r.uid.slice(0, 8), r.pack);
        return json({ ok: true, skip: "no kv" }, 200, env);
      }
      const bk = `b:${r.uid}`;
      const cur = (await env.TELOS_USAGE.get(bk, "json")) || {};
      const next = { ...cur, [r.pack.unit]: (cur[r.pack.unit] || 0) + r.pack.n };
      await env.TELOS_USAGE.put(bk, JSON.stringify(next));
      console.info("[billing]", r.name, "→", r.uid.slice(0, 8), `pack +${r.pack.n}${r.pack.unit}`);
      return json({ ok: true }, 200, env);
    }
    await billingPatchUser(env, r.uid, r.patch);
    console.info("[billing]", r.name, "→", r.uid.slice(0, 8), r.patch.pro ? `pro(${r.patch.plan})` : "off");
    return json({ ok: true }, 200, env);
  } catch (e) {
    console.error("[billing] patch failed:", String(e.message || e));
    return json({ error: "patch failed" }, 500, env); // 5xx → 服务商会重试
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "");
    const eenv = effectiveEnv(env, request); // BYOK：调用方自有 key/base/model 覆盖；env 仅回退

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }
    if (request.method === "GET" && (path === "" || path === "/health")) {
      const sc = searchConfig(eenv);
      return json(
        {
          ok: true,
          available: !!eenv.TELOS_LLM_API_KEY,
          hosted: hostedEnabled(env), // 托管模式（登录即用、按账号计量）是否开启
          model: eenv.TELOS_LLM_MODEL || "deepseek-v4-pro",
          search: { provider: sc.provider, available: sc.provider !== "none" && !!sc.key },
        },
        200,
        env,
      );
    }
    if (request.method === "GET" && path === "/billing/usage") {
      return hostedUsage(request, env);
    }
    if (request.method === "POST" && path === "/template") {
      return templateContent(request, env); // 付费模板内容：鉴权后从 KV 下发（内容不在前端）
    }
    if (request.method === "POST" && path === "/cert/register") {
      return certRegister(request, env); // 完课证书登记（登录）
    }
    if (request.method === "GET" && path === "/cert/verify") {
      return certVerify(url, env); // 证书验真（公开）
    }
    // 托管门禁：BYOK 请求（带 X-Telos-Key）原样放行不计量；否则验账号 + 扣配额。
    // gate.commit() 在推理成功后调用——失败的请求不扣次数。
    let hostedCommit = null;
    if (request.method === "POST" && ["/derive", "/lesson", "/probe", "/title"].includes(path)) {
      const byok = !!(request.headers.get("X-Telos-Key") || "").trim();
      if (!byok) {
        const unit = path === "/derive" ? "d" : path === "/title" ? null : "l";
        const gate = await hostedGate(request, env, unit);
        if (gate.deny) return gate.deny;
        hostedCommit = gate.commit;
      }
    }
    if (request.method === "POST" && path === "/billing/webhook") {
      return billingWebhook(request, env); // 支付服务商回调（验签在内部）
    }
    if (request.method === "POST" && path === "/derive") {
      let goal = "";
      let lang = "";
      try {
        const body = await request.json();
        goal = String(body.goal || "").trim();
        lang = String(body.lang || "");
      } catch {
        return json({ error: '请求体需为 JSON：{"goal": "..."}' }, 400, env);
      }
      if (!goal) return json({ error: "goal 不能为空" }, 400, env);
      if (goal.length > 200) return json({ error: "goal 过长" }, 400, env);
      if (!eenv.TELOS_LLM_API_KEY) return json({ error: "NO_KEY" }, 401, env);
      // 流式（NDJSON）：客户端带 Accept: application/x-ndjson → 按真实里程碑逐行吐进度，末行 {"t":"done",...图谱}。
      // 不带该头 → 原单发 JSON（向后兼容）。
      if ((request.headers.get("accept") || "").includes("application/x-ndjson")) {
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const enc = new TextEncoder();
        const emit = (o) => writer.write(enc.encode(JSON.stringify(o) + "\n"));
        (async () => {
          try {
            const out = await derive(goal, eenv, lang, emit);
            if (hostedCommit) await hostedCommit(); // 成功才扣配额
            await emit({ t: "done", goal: out.goal ?? goal, title: out.title, points: out.points });
          } catch (e) {
            await emit({ t: "error", message: String(e.message || e) });
          } finally {
            await writer.close();
          }
        })();
        return new Response(readable, {
          status: 200,
          headers: { ...corsHeaders(env), "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache", "X-Accel-Buffering": "no" },
        });
      }
      try {
        const out = await derive(goal, eenv, lang);
        if (hostedCommit) await hostedCommit(); // 成功才扣配额
        return json(out, 200, env);
      } catch (e) {
        return json({ error: String(e.message || e) }, 502, env);
      }
    }
    if (request.method === "POST" && path === "/lesson") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "请求体需为 JSON" }, 400, env);
      }
      try {
        const out = await lesson(body, eenv);
        if (hostedCommit) await hostedCommit();
        return json(out, 200, env);
      } catch (e) {
        return json({ error: String(e.message || e) }, 502, env);
      }
    }
    if (request.method === "POST" && path === "/title") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "请求体需为 JSON" }, 400, env);
      }
      const goal = String(body.goal || "").trim();
      if (!goal) return json({ error: "goal 不能为空" }, 400, env);
      return json({ title: await summarizeTitle(goal, eenv, String(body.lang || "")) }, 200, env);
    }
    if (request.method === "POST" && path === "/probe") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "请求体需为 JSON" }, 400, env);
      }
      try {
        const out = await probes(body, eenv);
        if (hostedCommit) await hostedCommit();
        return json(out, 200, env);
      } catch (e) {
        return json({ error: String(e.message || e) }, 502, env);
      }
    }
    return json({ error: "not found" }, 404, env);
  },
};
