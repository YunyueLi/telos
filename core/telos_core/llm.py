"""Optional LLM-backed reverse derivation: a goal → a prerequisite knowledge graph.

Runs locally / server-side where the API key is PRIVATE (never in the static web
client — a key in front-end code is public). OpenAI-compatible; defaults to DeepSeek.
Config via environment (see core/.env.example):
    TELOS_LLM_API_KEY    your key — keep secret, never commit
    TELOS_LLM_BASE_URL   default https://api.deepseek.com
    TELOS_LLM_MODEL      default deepseek-chat
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request

from .models import KnowledgeGraph

_ENV_LOADED = False


def _load_env_file() -> None:
    """Best-effort: load core/.env into os.environ (no dependency on python-dotenv)."""
    global _ENV_LOADED
    if _ENV_LOADED:
        return
    _ENV_LOADED = True
    path = os.path.join(os.path.dirname(__file__), "..", ".env")
    try:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    except FileNotFoundError:
        pass


def _config() -> tuple[str, str, str]:
    _load_env_file()
    key = os.environ.get("TELOS_LLM_API_KEY") or os.environ.get("DEEPSEEK_API_KEY") or ""
    if key.startswith("sk-your") or key in ("", "changeme", "your-key-here"):
        key = ""  # treat placeholders as "not configured"
    base = os.environ.get("TELOS_LLM_BASE_URL", "https://api.deepseek.com").rstrip("/")
    model = os.environ.get("TELOS_LLM_MODEL", "deepseek-chat")
    return key, base, model


def available() -> bool:
    return bool(_config()[0])


def _lang_directive(lang: str) -> str:
    """输出语言指令（#7 i18n）：让生成的面向学习者文本用指定语言；JSON 键名保持英文。缺省不限定。"""
    lang = (lang or "").strip()
    if not lang:
        return ""
    return (
        f"\n\n【输出语言】所有面向学习者的自然语言文本（名称 name / 描述 desc / 讲解 / 选项 / 题干 / "
        f"解析 / 资源名 等）必须用 {lang} 书写；JSON 的字段名(key)与枚举值(如 domain、kind)保持英文不变。"
    )


# ---- 联网检索（agentic grounding）：拿真实来源喂给模型，杜绝模型编造 URL ----
# 默认 provider=none（不联网，优雅降级回平台搜索链接）。配 TELOS_SEARCH_PROVIDER=tavily|youtube 启用。


def _search_config() -> tuple[str, str]:
    _load_env_file()
    provider = (os.environ.get("TELOS_SEARCH_PROVIDER") or "none").strip().lower()
    key = (os.environ.get("TELOS_SEARCH_API_KEY") or "").strip()
    if key.startswith("your") or key in ("", "changeme", "tvly-your-key-here"):
        key = ""
    return provider, key


def _domain_of(url: str) -> str:
    try:
        from urllib.parse import urlparse

        host = urlparse(url).netloc.lower()
        return host[4:] if host.startswith("www.") else host
    except Exception:
        return ""


def _search_tavily(query: str, key: str, k: int) -> list:
    body = json.dumps(
        {"api_key": key, "query": query, "max_results": max(1, min(k, 8)), "search_depth": "basic"}
    ).encode("utf-8")
    req = urllib.request.Request(
        "https://api.tavily.com/search", data=body, headers={"Content-Type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(req, timeout=12) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    out = []
    for r in (data.get("results") or [])[:k]:
        url, title = str(r.get("url", "")).strip(), str(r.get("title", "")).strip()
        if url and title:
            out.append(
                {"title": title, "url": url, "snippet": str(r.get("content", "")).strip()[:200], "domain": _domain_of(url)}
            )
    return out


def _search_youtube(query: str, key: str, k: int) -> list:
    from urllib.parse import urlencode

    qs = urlencode(
        {"part": "snippet", "q": query, "type": "video", "maxResults": max(1, min(k, 8)),
         "key": key, "relevanceLanguage": "zh", "safeSearch": "moderate"}
    )
    req = urllib.request.Request("https://www.googleapis.com/youtube/v3/search?" + qs, method="GET")
    with urllib.request.urlopen(req, timeout=12) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    out = []
    for it in data.get("items") or []:
        vid = (it.get("id") or {}).get("videoId")
        sn = it.get("snippet") or {}
        title = str(sn.get("title", "")).strip()
        if vid and title:
            out.append(
                {"title": title, "url": f"https://www.youtube.com/watch?v={vid}",
                 "snippet": str(sn.get("description", "")).strip()[:200], "domain": "youtube.com"}
            )
    return out


def web_search(query: str, k: int = 5) -> list:
    """联网检索真实来源，返回 [{title,url,snippet,domain}]；未配置/出错 → []（优雅降级，绝不抛错）。"""
    provider, key = _search_config()
    if not key or provider in ("", "none"):
        return []
    try:
        if provider == "tavily":
            return _search_tavily(query, key, k)
        if provider == "youtube":
            return _search_youtube(query, key, k)
    except Exception:
        return []
    return []


_SYSTEM = (
    "你是一位精通刻意练习(deliberate practice)、胜任力框架(EPA/CEFR/ACS)与逆向设计的世界级教练。"
    "给定一个目标，你倒推出达成它真正需要的【可训练能力】——不是知识点清单。"
    "每个能力都可观测、可练习、有量化达标线，并标注前置依赖形成有向无环图(DAG)。只输出 JSON。"
)

_USER = (
    "目标：{goal}\n\n"
    "先判断主导学习类型 domain：A=陈述记忆 / B=良构程序(数学/编程) / C=创造(写作/设计) / "
    "D=动作技能(乐器/运动/手法) / E=开放对抗(竞技体育/电竞/辩论/商战) / F=习惯养成。"
    "然后把目标倒推成 10-16 个【可训练能力节点】，输出严格 JSON：\n"
    '{{"title":"把目标概括成的简洁标题","points":[{{"id":"slug","name":"能做到的事(动宾短语)","prerequisites":["前置id"],"is_goal":false,"minutes":40,"domain":"E",'
    '"desc":"can-do：在什么条件下能做到什么、到什么标准","drill":"怎么刻意练习(具体方法/反馈来源/如何逐步加难)","benchmark":"一个可量化或可观测的达标线(分新手/进阶/精英更好)"}}]}}\n'
    "硬性要求(违反就重写该节点)：\n"
    "0) title：把目标概括成一个简洁的【主题标题】，像课程名，用于导航栏显示——中文≤12字、英文≤4词；"
    "提炼核心主题，绝不照抄整句目标、不要带『我想/学会/达到…水平』这类口语。\n"
    "1) 节点是【能力/可练单元】，不是知识名词。name 用动宾短语(如『把补刀稳定到14分钟120刀』)；"
    "禁止『了解/熟悉/理解X基础/综合能力/心理素质/基础操作』这类泛泛、不可观测的节点。\n"
    "2) 每个节点必须：可观测(能在一段录像/一局/一份作品里看见它发生)、可练习(能设计反复做且渐进加难的 drill)、"
    "有完成标准(benchmark 给量化或行为达标线)。\n"
    "3) 每个节点要能体现『高手与新手在这件事上的差距具体是什么数字/行为』——靠 benchmark 说清。\n"
    "4) 按 domain 调整 drill/benchmark：E 对抗/D 动作→节点是带『动态对手/资源/时间压力』情境的可练技能，"
    "drill 用复盘(VOD)/陪练(scrim)/专项训练，benchmark 用表现数据；C 创造→作品 + rubric 维度；"
    "A/B→应用层能力(在新情境中运用，而非死记)。对抗/创造类至少 1/3 的高层节点考『新局面下的临场决策/迁移』。\n"
    "5) id 为唯一英文 slug；prerequisites 只引用本列表 id 且不成环；由易到难分层；恰有一个 is_goal=true 的终点(目标本身)；"
    "minutes 为预计投入分钟数。只输出 JSON，不要解释。"
)


def _derive_context(goal: str) -> str:
    """倒推前联网检索真实课程/路径作背景，让能力图谱更贴合主流学习路径与真实术语。未配/出错 → ''。"""
    src = web_search(f"{goal} 学习路径 课程大纲 入门", k=4)
    if not src:
        return ""
    lines = "\n".join(
        f"- {s['title']}（{s['domain']}）" + (f"：{s['snippet'][:70]}" if s.get("snippet") else "") for s in src
    )
    return (
        "\n\n【联网参考资料（仅作背景）】以下为检索到的真实课程/资料标题与摘要——"
        "据此让能力节点更贴合主流学习路径与真实术语；务必提炼为【可训练能力】，不要照抄标题、不要堆知识点：\n" + lines
    )


def derive_graph(goal: str, timeout: float = 60.0, lang: str = "") -> KnowledgeGraph:
    """Call the LLM to reverse-derive a KnowledgeGraph from a free-text goal."""
    key, base, model = _config()
    if not key:
        raise RuntimeError(
            "未配置 LLM API key。请在 core/.env 设置 TELOS_LLM_API_KEY（见 core/.env.example）。"
        )
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": _USER.format(goal=goal) + _derive_context(goal) + _lang_directive(lang)},
        ],
        "temperature": 0.2,
        "stream": False,
        "response_format": {"type": "json_object"},
    }
    req = urllib.request.Request(
        base + "/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"LLM 请求失败 HTTP {e.code}（检查 key / base_url / model）") from e
    content = data["choices"][0]["message"]["content"]
    spec = json.loads(content)
    g = _to_graph(spec)
    # 概括标题（用于导航栏；非破坏性地挂到图对象，serve.py 会带出，CLI 忽略）
    if isinstance(spec, dict):
        title = str(spec.get("title", "")).strip()
        if title:
            try:
                g.title = title[:40]
            except Exception:
                pass
    return g


def _to_graph(spec: dict) -> KnowledgeGraph:
    points = spec.get("points") if isinstance(spec, dict) else None
    if not points:
        raise RuntimeError("LLM 返回缺少 points 字段")
    rows = [
        (
            str(p["id"]),
            str(p.get("name", p["id"])),
            tuple(p.get("prerequisites") or []),
            bool(p.get("is_goal", False)),
            int(p.get("minutes", 25)),
            str(p.get("domain", "B")),
            str(p.get("desc", "")),
            str(p.get("drill", "")),
            str(p.get("benchmark", "")),
        )
        for p in points
    ]
    return KnowledgeGraph.from_spec(rows)  # validates the DAG + prerequisite existence


# ---- 按需微课：讲解 + worked example + 一道检查题（喂回引擎做 teach-verify）----

_LESSON_SYSTEM = (
    "你是一位精通认知科学的微课设计师。针对单个知识点，设计一节【交互式、能真正学会】的微课——"
    "靠『让学习者动手、预测、补全、检索』来建构理解，而不是堆砌讲解文字。"
    "遵循证据：预测先行 → 直觉讲解 → 分步范例 → 自我解释 → 渐隐填空(worked-example fading) → 无脚手架检索(掌握闸门)；"
    "答错时给【提示阶梯】，逐步逼近但绝不直接给答案。只输出 JSON。"
)

# header 带占位符（.format 注入）；body 含 JSON 模板，保持原始花括号，不走 .format。
_LESSON_HEADER = (
    "知识点：{name}\n所属目标：{goal}\n学习类型(domain)：{domain}\n学习者已掌握的前置：{prereqs}\n\n"
)
# 步骤模板（concept + 6 步），结尾停在 steps 数组之后，便于拼接两种 resources 指令。
_LESSON_STEPS = (
    "设计一节交互式微课，严格输出如下 JSON（steps 必须正好按此 6 步顺序、kind 用英文小写）：\n"
    '{\n'
    ' "concept":"一句话点出这个知识点的核心要义 / 高手的关键认知",\n'
    ' "steps":[\n'
    '  {"kind":"predict","prompt":"讲解前先抛出的核心问题，让学习者先猜（低风险、不计分）","options":["..4 项.."],"answer":0,"reveal":"揭示正确项并一句话点出为何，自然引出讲解"},\n'
    '  {"kind":"explain","text":"≤160 字、建立直觉的讲解，点出高手与新手的关键差别，不要只给定义","analogy":"用学习者已掌握的前置打一个贴切类比（无前置则用生活常识）"},\n'
    '  {"kind":"worked","problem":"一个带具体情境/数字、能照着做一遍的真实范例","steps":[{"do":"这一步做什么","why":"为什么/关键点"}]},\n'
    '  {"kind":"self_explain","prompt":"针对上面范例的某一步问『为什么这样做/为何成立』","options":["..4 项.."],"answer":0,"rationale":"为什么对"},\n'
    '  {"kind":"faded","problem":"与范例同类型的新题","given":["已替学习者写好的前几步（文字）"],"prompt":"最后一步该怎么做？","options":["..4 项.."],"answer":0,"hints":["提示1：方向","提示2：更具体","提示3：几乎点破但不给答案"],"rationale":"为什么"},\n'
    '  {"kind":"retrieve","prompt":"一道全新的、无任何脚手架的应用/情境判断题（掌握闸门）","options":["..4 项.."],"answer":0,"hints":["提示1","提示2"],"rationale":"为什么对、其它为何错"}\n'
    ' ],\n'
)
_LESSON_REQS = (
    "硬性要求：\n"
    "- 每道选择题恰 4 个选项，answer 为正确项下标(0-3)，唯一正确；错项要对应进阶者真实会犯的误解，禁止送分题。\n"
    "- worked.steps 给 3-5 步，每步含 do+why，能照着做一遍。\n"
    "- faded 是『完成式问题』：given 写好前几步、把最后一步留空让学习者补；hints 是【提示阶梯】2-3 条，由浅入深、最后一条几乎点破但仍不直接给答案。\n"
    "- retrieve 是无脚手架的迁移题，作为掌握闸门。\n"
    "- 按 domain 调整：A 记忆=例子/助记；B 程序=可分步范例；C 创造=范例+rubric 要点；D 动作=分解练习+达标反馈；E 对抗=情境拆解+决策；F 习惯=触发-行为-奖励设计。\n"
)


def _lesson_user(name: str, domain: str, prereqs, goal: str) -> str:
    # LLM 永远推荐资源（含视频公开课）—— 不依赖检索，保证无 Tavily 也有好体验。
    # Tavily（若配置）在 lesson() 里后置增强：把真实直达链接前置到列表，而非替换这些建议。
    pre = "、".join(prereqs) if prereqs else "（无）"
    head = _LESSON_HEADER.format(name=name, domain=domain, prereqs=pre, goal=goal)
    body = _LESSON_STEPS
    body += ' "resources":[{"name":"真实存在、口碑最好的公开课/视频名","platform":"YouTube/B站/Coursera/官方文档"}]\n}\n'
    body += _LESSON_REQS
    body += (
        "- resources 给 2-3 个真实存在、口碑最好的优质学习资源，**至少包含 1 个视频公开课**"
        "（YouTube/B站/Coursera/中国大学MOOC 等）；只写课程/视频名 + 平台，绝不编造 URL。\n只输出 JSON。"
    )
    return head + body

_MCQ_KINDS = ("predict", "self_explain", "faded", "retrieve")


def _mcq_fields(s: dict):
    options = [str(o) for o in (s.get("options") or []) if str(o).strip()]
    if len(options) < 2:
        return None
    try:
        answer = int(s.get("answer", 0))
    except (TypeError, ValueError):
        answer = 0
    answer = max(0, min(answer, len(options) - 1))
    hints = [str(h).strip() for h in (s.get("hints") or []) if str(h).strip()]
    return options, answer, hints


def _resolve_resources(spec: dict) -> list:
    """规整 LLM 建议的资源为 [{name, platform}]（最多 3 个，去重）。前端无真链时回退平台搜索。"""
    out, seen = [], set()
    for r in (spec.get("resources") or [])[:6]:
        if not isinstance(r, dict):
            continue
        name = str(r.get("name", "")).strip()
        if not name or name in seen:
            continue
        seen.add(name)
        out.append({"name": name, "platform": str(r.get("platform", "")).strip()})
        if len(out) >= 3:
            break
    return out


def _search_resources(topic: str, k: int = 2) -> list:
    """Tavily 命中真实来源 → 真链资源卡（前置到 LLM 建议之前做增强）。未配/出错 → []。"""
    out = []
    for s in web_search(f"{topic} 教程 公开课".strip(), k=4):
        out.append(
            {"name": s["title"][:60], "url": s["url"], "domain": s.get("domain", ""),
             "platform": s.get("domain", ""), "snippet": s.get("snippet", "")}
        )
        if len(out) >= k:
            break
    return out


def _merge_resources(real: list, suggested: list) -> list:
    """真链卡(real)在前 + LLM 建议(suggested)在后，按 url/域名/名称去重，最多 4 个。
    Tavily 是增强：有真链也保留 LLM 的视频公开课建议，二者互补。"""
    out, seen = [], set()
    for r in list(real) + list(suggested):
        dom = (r.get("domain") or "").strip()
        key = (r.get("url") or "").strip() or r.get("name", "")
        if key in seen or (dom and dom in seen):
            continue
        seen.add(key)
        if dom:
            seen.add(dom)
        out.append(r)
        if len(out) >= 4:
            break
    return out


def _validate_lesson(spec: dict) -> dict:
    if not isinstance(spec, dict):
        raise RuntimeError("微课返回格式错误")
    out_steps = []
    for s in spec.get("steps") or []:
        if not isinstance(s, dict):
            continue
        kind = str(s.get("kind", "")).strip()
        if kind == "explain":
            text = str(s.get("text", "")).strip()
            if text:
                out_steps.append({"kind": "explain", "text": text, "analogy": str(s.get("analogy", "")).strip()})
        elif kind == "worked":
            wsteps = []
            for w in s.get("steps") or []:
                if isinstance(w, dict) and str(w.get("do", "")).strip():
                    wsteps.append({"do": str(w["do"]).strip(), "why": str(w.get("why", "")).strip()})
                elif str(w).strip():
                    wsteps.append({"do": str(w).strip(), "why": ""})
            if wsteps:
                out_steps.append({"kind": "worked", "problem": str(s.get("problem", "")).strip(), "steps": wsteps})
        elif kind in _MCQ_KINDS:
            m = _mcq_fields(s)
            if not m:
                continue
            options, answer, hints = m
            q = str(s.get("prompt") or s.get("q") or "").strip()
            if not q:
                continue
            step = {"kind": kind, "prompt": q, "options": options, "answer": answer}
            if kind == "predict":
                step["reveal"] = str(s.get("reveal", "")).strip()
            if kind == "faded":
                step["problem"] = str(s.get("problem", "")).strip()
                step["given"] = [str(g).strip() for g in (s.get("given") or []) if str(g).strip()]
            if kind in ("self_explain", "faded", "retrieve"):
                step["rationale"] = str(s.get("rationale", "")).strip()
            if kind in ("faded", "retrieve"):
                step["hints"] = hints
            out_steps.append(step)
    graded = [st for st in out_steps if st["kind"] in ("retrieve", "faded", "self_explain")]
    if not out_steps or not graded:
        raise RuntimeError("微课内容不完整")
    return {"concept": str(spec.get("concept", "")).strip(), "steps": out_steps, "resources": _resolve_resources(spec)}


def lesson(name: str, domain: str = "B", prereqs=(), goal: str = "", timeout: float = 110.0, lang: str = "") -> dict:
    """生成一个知识点的按需微课（OpenAI 兼容；返回校验过的 dict）。"""
    key, base, model = _config()
    if not key:
        raise RuntimeError("未配置 LLM API key（见 core/.env.example）。")
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": _LESSON_SYSTEM},
            {"role": "user", "content": _lesson_user(name, domain, prereqs, goal) + _lang_directive(lang)},
        ],
        "temperature": 0.3,
        "stream": False,
        "response_format": {"type": "json_object"},
    }
    req = urllib.request.Request(
        base + "/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"LLM 请求失败 HTTP {e.code}（检查 key / base_url / model）") from e
    content = data["choices"][0]["message"]["content"]
    out = _validate_lesson(json.loads(content))
    # Tavily 增强（可选）：把真实直达链接前置到 LLM 建议之前，二者互补；未配则只用 LLM 建议
    topic = (f"{goal} " if goal else "") + name
    real = _search_resources(topic)
    if real:
        out["resources"] = _merge_resources(real, out["resources"])
    return out


# ---- 起点诊断：一次性为一组知识点各生成一道诊断单选题（客观探针）----

_PROBES_SYSTEM = (
    "你是一位顶尖的测评专家。你出的诊断题考【应用/分析/决策】而非记忆，"
    "每个错误选项都对应一种真实存在的高水平误解——有似是而非错误心智模型的进阶者会被带偏，真专家不会。只输出 JSON。"
)

_PROBES_USER = (
    "目标：{goal}\n知识点列表(id ｜ 名称 ｜ 类型)：\n{items}\n\n"
    "为每个 id 出一道有区分度的诊断题，输出严格 JSON：\n"
    '{{"probes":{{"<id>":{{"q":"题干","options":["A","B","C","D"],"answer":0,"rationale":"为何对，及每个错项对应哪种误解"}}}}}}\n'
    "硬性要求：\n"
    "1) 禁止送分题：不要『X最需要什么/最重要的是』这类有明显安全答案的题，不要纯背定义。\n"
    "2) 考高阶(应用/分析/评价)：给一个具体情境或案例，问最优判断 / 下一步该做什么 / 为什么。\n"
    "3) 对抗(E)/动作(D)类出【情境判断题】：描述一个真实局面(含对手/资源/时间压力)，在 4 个看似都合理的行动里选最优。\n"
    "4) 每个错误选项必须对应一种【真实的高水平误解】(如『过度求稳放弃节奏』『只看自家数据忽视全局』『无脑服从指令而不做风险评估』)，"
    "使持错误心智模型的进阶者被带偏、真专家会避开；不要编明显荒谬的错项。\n"
    "5) 恰 4 个选项、answer 为正确项下标(0-3)、唯一正确答案；键必须用给定 id。只输出 JSON。"
)


def probes(points, goal: str = "", timeout: float = 90.0, lang: str = "") -> dict:
    """一次性为一组知识点各生成一道诊断单选题。points: [{'id','name','domain'}, ...]。"""
    key, base, model = _config()
    if not key:
        raise RuntimeError("未配置 LLM API key（见 core/.env.example）。")
    items = "\n".join(
        f"- {p.get('id')} ｜ {p.get('name', p.get('id'))} ｜ {p.get('domain', 'B')}" for p in points
    )
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": _PROBES_SYSTEM},
            {"role": "user", "content": _PROBES_USER.format(goal=goal, items=items) + _lang_directive(lang)},
        ],
        "temperature": 0.3,
        "stream": False,
        "response_format": {"type": "json_object"},
    }
    req = urllib.request.Request(
        base + "/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"LLM 请求失败 HTTP {e.code}（检查 key / base_url / model）") from e
    spec = json.loads(data["choices"][0]["message"]["content"])
    raw = spec.get("probes") if isinstance(spec, dict) else None
    if not isinstance(raw, dict):
        raise RuntimeError("诊断题返回缺少 probes")
    out: dict = {}
    for pid, q in raw.items():
        if not isinstance(q, dict):
            continue
        options = [str(o) for o in (q.get("options") or []) if str(o).strip()]
        if not str(q.get("q", "")).strip() or len(options) < 2:
            continue
        try:
            ans = int(q.get("answer", 0))
        except (TypeError, ValueError):
            ans = 0
        out[str(pid)] = {
            "q": str(q["q"]).strip(),
            "options": options,
            "answer": max(0, min(ans, len(options) - 1)),
            "rationale": str(q.get("rationale", "")).strip(),
        }
    if not out:
        raise RuntimeError("没有可用的诊断题")
    return {"probes": out}
