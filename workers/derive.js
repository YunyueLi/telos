// Telos 倒推代理 —— Cloudflare Worker 版（给公开网页用）。
//
// 与 core/telos_core/llm.py 等价：目标 → 前置知识 DAG。
// API key 存 Worker secret（TELOS_LLM_API_KEY），永远在服务端，绝不进前端代码。
//
// 部署见 ../DERIVE.md。本文件零依赖，OpenAI 兼容，默认 DeepSeek。

const SYSTEM =
  "你是一位课程设计师，精通逆向设计(backward design)与知识空间理论。" +
  "给定一个学习目标，从结果倒推出达成所需的知识点，标注它们之间的前置依赖，" +
  "形成一个有向无环图(DAG)。只输出 JSON。";

const USER = (goal) =>
  `目标：${goal}\n\n` +
  "倒推出 8-14 个知识点，输出严格的 JSON：\n" +
  '{"points":[{"id":"slug","name":"中文名","prerequisites":["前置id"],"is_goal":false,"minutes":25,"domain":"B"}]}\n' +
  "要求：id 为唯一的简短英文 slug；prerequisites 只引用本列表中的 id 且不成环；" +
  "恰有一个终点知识点 is_goal=true（即目标本身）；按由易到难大致排列；minutes 为预计学习分钟数；" +
  "domain 为该知识点的学习类型：A=陈述性记忆(词汇/术语/事实)，B=良构程序或算法(数学/编程/可分步)，" +
  "C=创造或设计(写作/构思，无唯一解)，D=身体动作技能(乐器/运动)，E=对抗或临场表现(竞技/辩论)，F=习惯/情感/态度养成。" +
  "只输出 JSON，不要解释。";

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
  "要求：explain 通俗有直觉；worked 是一个走通的范例；check 恰好 4 个选项、answer 为正确项下标(0-3)、" +
  "有唯一正确答案、干扰项要像样能暴露常见误解。按学习类型调整：A 记忆=例子/助记；B 程序=可分步范例；" +
  "C 创造=范例+要点；D 动作=分解练习步骤；E 对抗=情境拆解；F 习惯=微行动建议。只输出 JSON。";

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
    return json({ error: "not found" }, 404, env);
  },
};
