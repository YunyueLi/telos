// Telos 倒推代理 —— Cloudflare Worker 版（给公开网页用）。
//
// 与 core/telos_core/llm.py 等价：目标 → 前置知识 DAG。
// API key 存 Worker secret（TELOS_LLM_API_KEY），永远在服务端，绝不进前端代码。
//
// 部署见 ../DERIVE.md。本文件零依赖，OpenAI 兼容，默认 DeepSeek。

const SYSTEM =
  "你是一位精通刻意练习(deliberate practice)、胜任力框架(EPA/CEFR/ACS)与逆向设计的世界级教练。" +
  "给定一个目标，你倒推出达成它真正需要的【可训练能力】——不是知识点清单。" +
  "每个能力都可观测、可练习、有量化达标线，并标注前置依赖形成有向无环图(DAG)。只输出 JSON。";

const USER = (goal) =>
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
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
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

const BLUEPRINT_SYSTEM =
  "你是精通逆向课程设计(backward design)、胜任力框架(CEFR/Bloom/EPA)与知识空间理论的总架构师。" +
  "给定目标，你先判断它的广度，再把它倒推成一份有序的【模块/阶段大纲】(像一门课的章节路线图)，" +
  "为后续逐模块展开可训练能力搭好骨架。模块要把这门学习【完整覆盖】、相邻模块递进。只输出 JSON。";

const BLUEPRINT_USER = (goal) =>
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

const MODULE_USER = (goal, modlist, goalName, mid, mtitle, msum, target) =>
  `总目标：${goal}\n这门学习的全部模块(顺序)：${modlist}\n终点产出：${goalName}\n\n` +
  `现在只展开这一个模块：【${mid}】${mtitle} —— ${msum}\n` +
  `把它展开成约 ${target} 个可训练能力节点，严格输出 JSON：\n` +
  '{"nodes":[{"id":"模块内唯一英文slug","name":"能做到的事(动宾短语,用Bloom动词)","domain":"A-F","minutes":40,"desc":"can-do：在什么条件下能做到什么、到什么标准","drill":"怎么刻意练习(方法/反馈来源/如何加难)","benchmark":"量化或可观测达标线(分新手/进阶/精英更好)","prereq_ids":["本模块内更基础节点的id"],"prereq_hints":["需要先掌握但属于其它模块的能力(用自然语言短语,不要编id)"]}]}\n' +
  "硬性要求：1)节点是能力/可练单元，name 用动宾短语(如『把补刀稳定到14分钟120刀』)；禁止『了解/熟悉/理解X基础/综合能力/心理素质』这类不可观测的词。2)每个节点可观测、能设计反复且渐进加难的 drill、benchmark 给量化或行为达标线(体现高手与新手差距)。3)按 domain 调整：E对抗/D动作→带动态对手/时间压力的情境技能、drill用复盘(VOD)/陪练、benchmark用表现数据；C创造→作品+rubric维度；A/B→在新情境中运用而非死记。4)prereq_ids 只引用本模块内 id；跨模块前置写进 prereq_hints(自然语言)。由易到难。只输出 JSON。";

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

async function parallelExpand(goal, bp, env, lang) {
  const out = {};
  await Promise.all(
    bp.modules.map(async (m) => {
      try {
        out[m.id] = await expandModule(goal, bp, m, env, lang);
      } catch {
        out[m.id] = [];
      }
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

async function derive(goal, env, lang) {
  const key = env.TELOS_LLM_API_KEY;
  if (!key) throw new Error("Worker 未配置 TELOS_LLM_API_KEY（用 wrangler secret put 设置）");
  const ctx = await deriveContext(goal, env);
  let spec = null;
  try {
    const bp = await blueprint(goal, ctx, env, lang);
    const expansions = await parallelExpand(goal, bp, env, lang);
    const total = Object.values(expansions).reduce((s, a) => s + a.length, 0);
    if (total >= 6) {
      const cand = assemble(goal, bp, expansions);
      if (cand.points.length >= 6) spec = cand;
    }
  } catch {
    spec = null;
  }
  if (!spec) spec = await deriveSingleSpec(goal, ctx, env, lang);
  return toGraph(spec, goal);
}

// 概括标题（给旧项目补标题，轻量纯文本）。失败/未配 → ''（前端回退到原目标）。
const TITLE_SYSTEM = "你把学习目标概括成一个简洁的【主题标题】，像课程名。只输出标题本身，不要引号、不要标点结尾、不要解释。";
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
  "硬性要求：每题恰 4 选项、answer 为正确项下标(0-3)、唯一正确、错项对应进阶者真实误解、禁止送分题；" +
  "worked.steps 给 3-5 步(每步 do+why)；faded 是完成式问题(given 写好前几步、留空最后一步)，hints 提示阶梯 2-3 条由浅入深、最后一条几乎点破但不给答案；retrieve 无脚手架作为掌握闸门；" +
  "按 domain 调整：A 记忆=例子/助记；B 程序=可分步范例；C 创造=范例+rubric；D 动作=分解练习+达标；E 对抗=情境拆解+决策；F 习惯=触发-行为-奖励；";

// LLM 永远推荐资源(含视频公开课)——不依赖检索；Tavily 在 lesson() 里后置增强(真链前置)，而非替换。
const LESSON_USER = (name, domain, prereqs, goal) => {
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

const PROBES_SYSTEM =
  "你是一位顶尖的测评专家。你出的诊断题考【应用/分析/决策】而非记忆，" +
  "每个错误选项都对应一种真实存在的高水平误解——有似是而非错误心智模型的进阶者会被带偏，真专家不会。只输出 JSON。";

const PROBES_USER = (items, goal) =>
  `目标：${goal}\n知识点列表(id ｜ 名称 ｜ 类型)：\n${items}\n\n` +
  '为每个 id 出一道有区分度的诊断题，输出严格 JSON：\n{"probes":{"<id>":{"q":"题干","options":["A","B","C","D"],"answer":0,"rationale":"为何对，及每个错项对应哪种误解"}}}\n' +
  "硬性要求：\n" +
  "1) 禁止送分题：不要『X最需要什么/最重要的是』这类有明显安全答案的题，不要纯背定义。\n" +
  "2) 考高阶(应用/分析/评价)：给一个具体情境或案例，问最优判断 / 下一步该做什么 / 为什么。\n" +
  "3) 对抗(E)/动作(D)类出【情境判断题】：描述一个真实局面(含对手/资源/时间压力)，在 4 个看似都合理的行动里选最优。\n" +
  "4) 每个错误选项必须对应一种【真实的高水平误解】(如『过度求稳放弃节奏』『只看自家数据忽视全局』『无脑服从指令而不做风险评估』)，使持错误心智模型的进阶者被带偏、真专家会避开；不要编明显荒谬的错项。\n" +
  "5) 恰 4 个选项、answer 为正确项下标(0-3)、唯一正确答案；键必须用给定 id。只输出 JSON。";

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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "");

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }
    if (request.method === "GET" && (path === "" || path === "/health")) {
      return json({ ok: true, available: !!env.TELOS_LLM_API_KEY, model: env.TELOS_LLM_MODEL || "deepseek-v4-pro" }, 200, env);
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
      try {
        return json(await derive(goal, env, lang), 200, env);
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
        return json(await lesson(body, env), 200, env);
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
      return json({ title: await summarizeTitle(goal, env, String(body.lang || "")) }, 200, env);
    }
    if (request.method === "POST" && path === "/probe") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "请求体需为 JSON" }, 400, env);
      }
      try {
        return json(await probes(body, env), 200, env);
      } catch (e) {
        return json({ error: String(e.message || e) }, 502, env);
      }
    }
    return json({ error: "not found" }, 404, env);
  },
};
