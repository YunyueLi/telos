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
  "你是一位精通认知科学的微课老师。针对单个知识点，产出极简微课：" +
  "建立直觉的讲解、一个走通的范例(worked example)、一道检验掌握的单选题。只输出 JSON。";

const LESSON_USER = (name, domain, prereqs, goal) =>
  `知识点：${name}\n所属目标：${goal}\n学习类型(domain)：${domain}\n已掌握的前置：${
    prereqs.length ? prereqs.join("、") : "（无）"
  }\n\n` +
  "产出严格 JSON：\n" +
  '{"explain":"不超过180字、建立直觉的讲解","worked":{"problem":"一个具体例子或任务","steps":["步骤1","步骤2","步骤3"]},"check":{"q":"一道检验是否掌握的单选题","options":["A","B","C","D"],"answer":0,"rationale":"为什么对、其它为何错"}}\n' +
  "要求：explain 建立直觉并点出『高手与新手的关键差别』，不要只给定义；" +
  "worked 是一个带具体情境/数字、能照着做一遍的真实范例，steps 给【3-6 个有实质内容的步骤】(每步:做什么 + 关键点/为什么)——对抗(E)/动作(D)类则给一次可练的 drill(怎么做、反馈从哪来、达标线)；" +
  "check 考应用/情境判断而非背定义，恰 4 选项、answer 为正确项下标(0-3)、唯一正确答案、" +
  "每个错项对应一种真实的高水平误解(进阶者会被带偏、专家会避开)，禁止送分题。" +
  "按 domain 调整：A 记忆=例子/助记；B 程序=可分步范例；C 创造=范例+rubric 要点；D 动作=分解练习+达标；E 对抗=情境拆解+决策。只输出 JSON。";

function toLesson(spec) {
  const explain = String(spec?.explain ?? "").trim();
  const worked = spec?.worked || {};
  const steps = (worked.steps || []).map(String).filter((s) => s.trim());
  const check = spec?.check || {};
  const options = (check.options || []).map(String).filter((o) => o.trim());
  let answer = parseInt(check.answer, 10);
  if (!Number.isFinite(answer)) answer = 0;
  if (!explain || options.length < 2 || !String(check.q ?? "").trim()) throw new Error("微课内容不完整");
  answer = Math.max(0, Math.min(answer, options.length - 1));
  return {
    explain,
    worked: { problem: String(worked.problem ?? "").trim(), steps },
    check: { q: String(check.q).trim(), options, answer, rationale: String(check.rationale ?? "").trim() },
  };
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
