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
    '{{"points":[{{"id":"slug","name":"能做到的事(动宾短语)","prerequisites":["前置id"],"is_goal":false,"minutes":40,"domain":"E",'
    '"desc":"can-do：在什么条件下能做到什么、到什么标准","drill":"怎么刻意练习(具体方法/反馈来源/如何逐步加难)","benchmark":"一个可量化或可观测的达标线(分新手/进阶/精英更好)"}}]}}\n'
    "硬性要求(违反就重写该节点)：\n"
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


def derive_graph(goal: str, timeout: float = 60.0) -> KnowledgeGraph:
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
            {"role": "user", "content": _USER.format(goal=goal)},
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
    return _to_graph(json.loads(content))


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
    "你是一位精通认知科学的微课老师。针对单个知识点，产出极简微课："
    "建立直觉的讲解、一个走通的范例(worked example)、一道检验掌握的单选题。只输出 JSON。"
)

_LESSON_USER = (
    "知识点：{name}\n所属目标：{goal}\n学习类型(domain)：{domain}\n已掌握的前置：{prereqs}\n\n"
    "产出严格 JSON：\n"
    '{{"explain":"不超过180字、建立直觉的讲解","worked":{{"problem":"一个具体例子或任务","steps":["步骤1","步骤2","步骤3"]}},'
    '"check":{{"q":"一道检验是否掌握的单选题","options":["A","B","C","D"],"answer":0,"rationale":"为什么对、其它为何错"}}}}\n'
    "要求：explain 建立直觉并点出『高手与新手的关键差别』，不要只给定义；"
    "worked 是一个带具体情境/数字、能照着做一遍的真实范例，steps 给【3-6 个有实质内容的步骤】(每步:做什么 + 关键点/为什么)——"
    "对抗(E)/动作(D)类则给一次可练的 drill(怎么做、反馈从哪来、达标线)；"
    "check 考应用/情境判断而非背定义，恰 4 选项、answer 为正确项下标(0-3)、唯一正确答案、"
    "每个错项对应一种真实的高水平误解(进阶者会被带偏、专家会避开)，禁止送分题。"
    "按 domain 调整：A 记忆=例子/助记；B 程序=可分步范例；C 创造=范例+rubric 要点；D 动作=分解练习+达标；E 对抗=情境拆解+决策。只输出 JSON。"
)


def _validate_lesson(spec: dict) -> dict:
    if not isinstance(spec, dict):
        raise RuntimeError("微课返回格式错误")
    explain = str(spec.get("explain", "")).strip()
    worked = spec.get("worked") or {}
    steps = [str(s) for s in (worked.get("steps") or []) if str(s).strip()]
    check = spec.get("check") or {}
    options = [str(o) for o in (check.get("options") or []) if str(o).strip()]
    try:
        answer = int(check.get("answer", 0))
    except (TypeError, ValueError):
        answer = 0
    if not explain or len(options) < 2 or not str(check.get("q", "")).strip():
        raise RuntimeError("微课内容不完整")
    answer = max(0, min(answer, len(options) - 1))
    return {
        "explain": explain,
        "worked": {"problem": str(worked.get("problem", "")).strip(), "steps": steps},
        "check": {
            "q": str(check["q"]).strip(),
            "options": options,
            "answer": answer,
            "rationale": str(check.get("rationale", "")).strip(),
        },
    }


def lesson(name: str, domain: str = "B", prereqs=(), goal: str = "", timeout: float = 60.0) -> dict:
    """生成一个知识点的按需微课（OpenAI 兼容；返回校验过的 dict）。"""
    key, base, model = _config()
    if not key:
        raise RuntimeError("未配置 LLM API key（见 core/.env.example）。")
    pre = "、".join(prereqs) if prereqs else "（无）"
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": _LESSON_SYSTEM},
            {"role": "user", "content": _LESSON_USER.format(name=name, domain=domain, prereqs=pre, goal=goal)},
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
    return _validate_lesson(json.loads(content))


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


def probes(points, goal: str = "", timeout: float = 90.0) -> dict:
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
            {"role": "user", "content": _PROBES_USER.format(goal=goal, items=items)},
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
