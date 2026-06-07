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
  '{"points":[{"id":"slug","name":"能做到的事(动宾短语)","prerequisites":["前置id"],"is_goal":false,"minutes":40,"domain":"E","desc":"can-do：在什么条件下能做到什么、到什么标准","drill":"怎么刻意练习(具体方法/反馈来源/如何逐步加难)","benchmark":"一个可量化或可观测的达标线(分新手/进阶/精英更好)"}]}\n' +
  "硬性要求(违反就重写该节点)：\n" +
  "1) 节点是【能力/可练单元】，不是知识名词。name 用动宾短语(如『把补刀稳定到14分钟120刀』)；禁止『了解/熟悉/理解X基础/综合能力/心理素质/基础操作』这类泛泛、不可观测的节点。\n" +
  "2) 每个节点必须：可观测(能在一段录像/一局/一份作品里看见)、可练习(能设计反复做且渐进加难的 drill)、有完成标准(benchmark 给量化或行为达标线)。\n" +
  "3) 每个节点要体现『高手与新手在这件事上的差距具体是什么数字/行为』——靠 benchmark 说清。\n" +
  "4) 按 domain 调整 drill/benchmark：E 对抗/D 动作→节点是带『动态对手/资源/时间压力』情境的可练技能，drill 用复盘(VOD)/陪练(scrim)/专项训练，benchmark 用表现数据；C 创造→作品 + rubric 维度；A/B→应用层能力(非死记)。对抗/创造类至少 1/3 高层节点考『新局面下的临场决策/迁移』。\n" +
  "5) id 为唯一英文 slug；prerequisites 只引用本列表 id 且不成环；由易到难分层；恰有一个 is_goal=true 的终点；minutes 为预计投入分钟数。只输出 JSON，不要解释。";

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
  return { goal, points: norm };
}

async function derive(goal, env) {
  const key = env.TELOS_LLM_API_KEY;
  if (!key) throw new Error("Worker 未配置 TELOS_LLM_API_KEY（用 wrangler secret put 设置）");
  const base = (env.TELOS_LLM_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
  const model = env.TELOS_LLM_MODEL || "deepseek-chat";
  const resp = await fetch(base + "/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: USER(goal) },
      ],
      temperature: 0.2,
      stream: false,
      response_format: { type: "json_object" },
    }),
  });
  if (!resp.ok) throw new Error(`LLM 请求失败 HTTP ${resp.status}（检查 key / base_url / model）`);
  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM 返回为空");
  return toGraph(JSON.parse(content), goal);
}

// ---- 按需微课 ----

const LESSON_SYSTEM =
  "你是一位精通认知科学的微课设计师。针对单个知识点，设计一节【交互式、能真正学会】的微课——" +
  "靠『让学习者动手、预测、补全、检索』来建构理解，而不是堆砌讲解文字。" +
  "遵循：预测先行 → 直觉讲解 → 分步范例 → 自我解释 → 渐隐填空 → 无脚手架检索(掌握闸门)；" +
  "答错给【提示阶梯】，逐步逼近但绝不直接给答案。只输出 JSON。";

const LESSON_USER = (name, domain, prereqs, goal) =>
  `知识点：${name}\n所属目标：${goal}\n学习类型(domain)：${domain}\n学习者已掌握的前置：${
    prereqs.length ? prereqs.join("、") : "（无）"
  }\n\n` +
  "设计一节交互式微课，严格输出如下 JSON（steps 必须正好按此 6 步顺序、kind 用英文小写）：\n" +
  '{"concept":"一句话点出核心要义/高手的关键认知","steps":[' +
  '{"kind":"predict","prompt":"讲解前先抛出的核心问题，让学习者先猜（低风险、不计分）","options":["..4 项.."],"answer":0,"reveal":"揭示正确项并一句话点出为何"},' +
  '{"kind":"explain","text":"≤160 字、建立直觉的讲解，点出高手与新手的关键差别","analogy":"用已掌握的前置打贴切类比（无则用生活常识）"},' +
  '{"kind":"worked","problem":"带具体情境/数字、能照着做一遍的真实范例","steps":[{"do":"做什么","why":"为什么/关键点"}]},' +
  '{"kind":"self_explain","prompt":"针对范例某一步问『为什么这样做』","options":["..4 项.."],"answer":0,"rationale":"为什么对"},' +
  '{"kind":"faded","problem":"同类型新题","given":["已写好的前几步"],"prompt":"最后一步该怎么做？","options":["..4 项.."],"answer":0,"hints":["提示1:方向","提示2:更具体","提示3:几乎点破"],"rationale":"为什么"},' +
  '{"kind":"retrieve","prompt":"全新、无脚手架的应用/情境判断题（掌握闸门）","options":["..4 项.."],"answer":0,"hints":["提示1","提示2"],"rationale":"为什么对、其它为何错"}' +
  '],"resources":[{"name":"真实存在、口碑最好的公开课/视频名","platform":"YouTube/B站/Coursera/官方文档"}]}\n' +
  "硬性要求：每题恰 4 选项、answer 为正确项下标(0-3)、唯一正确、错项对应进阶者真实误解、禁止送分题；" +
  "worked.steps 给 3-5 步(每步 do+why)；faded 是完成式问题(given 写好前几步、留空最后一步)，hints 提示阶梯 2-3 条由浅入深、最后一条几乎点破但不给答案；retrieve 无脚手架作为掌握闸门；" +
  "按 domain 调整：A 记忆=例子/助记；B 程序=可分步范例；C 创造=范例+rubric；D 动作=分解练习+达标；E 对抗=情境拆解+决策；F 习惯=触发-行为-奖励；" +
  "resources 给 2-3 个真实存在、口碑最好的公开课/视频(只写名+平台，绝不编造 URL)。只输出 JSON。";

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
  const resources = (Array.isArray(spec?.resources) ? spec.resources : [])
    .filter((r) => r && String(r.name || "").trim())
    .slice(0, 4)
    .map((r) => ({ name: String(r.name).trim(), platform: String(r.platform || "").trim() }));
  return { concept: String(spec?.concept || "").trim(), steps: out, resources };
}

async function lesson(body, env) {
  const key = env.TELOS_LLM_API_KEY;
  if (!key) throw new Error("Worker 未配置 TELOS_LLM_API_KEY（用 wrangler secret put 设置）");
  const name = String(body.name || "").trim();
  if (!name) throw new Error("name 不能为空");
  const base = (env.TELOS_LLM_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
  const model = env.TELOS_LLM_MODEL || "deepseek-chat";
  const prereqs = (body.prereqs || []).map(String);
  const resp = await fetch(base + "/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: LESSON_SYSTEM },
        { role: "user", content: LESSON_USER(name, String(body.domain || "B"), prereqs, String(body.goal || "")) },
      ],
      temperature: 0.3,
      stream: false,
      response_format: { type: "json_object" },
    }),
  });
  if (!resp.ok) throw new Error(`LLM 请求失败 HTTP ${resp.status}（检查 key / base_url / model）`);
  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM 返回为空");
  return toLesson(JSON.parse(content));
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
  const model = env.TELOS_LLM_MODEL || "deepseek-chat";
  const items = points.map((p) => `- ${p.id} ｜ ${p.name || p.id} ｜ ${p.domain || "B"}`).join("\n");
  const resp = await fetch(base + "/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: PROBES_SYSTEM },
        { role: "user", content: PROBES_USER(items, String(body.goal || "")) },
      ],
      temperature: 0.3,
      stream: false,
      response_format: { type: "json_object" },
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
      return json({ ok: true, available: !!env.TELOS_LLM_API_KEY, model: env.TELOS_LLM_MODEL || "deepseek-chat" }, 200, env);
    }
    if (request.method === "POST" && path === "/derive") {
      let goal = "";
      try {
        const body = await request.json();
        goal = String(body.goal || "").trim();
      } catch {
        return json({ error: '请求体需为 JSON：{"goal": "..."}' }, 400, env);
      }
      if (!goal) return json({ error: "goal 不能为空" }, 400, env);
      if (goal.length > 200) return json({ error: "goal 过长" }, 400, env);
      try {
        return json(await derive(goal, env), 200, env);
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
