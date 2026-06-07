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
    "你是一位课程设计师，精通逆向设计(backward design)与知识空间理论。"
    "给定一个学习目标，从结果倒推出达成所需的知识点，标注它们之间的前置依赖，"
    "形成一个有向无环图(DAG)。只输出 JSON。"
)

_USER = (
    "目标：{goal}\n\n"
    "倒推出 8-14 个知识点，输出严格的 JSON：\n"
    '{{"points":[{{"id":"slug","name":"中文名","prerequisites":["前置id"],"is_goal":false,"minutes":25,"domain":"B"}}]}}\n'
    "要求：id 为唯一的简短英文 slug；prerequisites 只引用本列表中的 id 且不成环；"
    "恰有一个终点知识点 is_goal=true（即目标本身）；按由易到难大致排列；minutes 为预计学习分钟数；"
    "domain 为该知识点的学习类型：A=陈述性记忆(词汇/术语/事实)，B=良构程序或算法(数学/编程/可分步)，"
    "C=创造或设计(写作/构思，无唯一解)，D=身体动作技能(乐器/运动)，E=对抗或临场表现(竞技/辩论)，F=习惯/情感/态度养成。"
    "只输出 JSON，不要解释。"
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
    "要求：explain 通俗有直觉；worked 是一个走通的范例；check 恰好 4 个选项、answer 为正确项下标(0-3)、"
    "有唯一正确答案、干扰项要像样能暴露常见误解。按学习类型调整：A 记忆=例子/助记；B 程序=可分步范例；"
    "C 创造=范例+要点；D 动作=分解练习步骤；E 对抗=情境拆解；F 习惯=微行动建议。只输出 JSON，不要解释。"
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
    "你是一位诊断测评专家。给定一组知识点，为每个写一道能判断学习者是否真正掌握的单选诊断题，"
    "干扰项要反映该点的常见误解(选错能暴露具体问题)。只输出 JSON。"
)

_PROBES_USER = (
    "目标：{goal}\n知识点列表(id ｜ 名称 ｜ 类型)：\n{items}\n\n"
    "为每个 id 产出严格 JSON：\n"
    '{{"probes":{{"<id>":{{"q":"题干","options":["A","B","C","D"],"answer":0,"rationale":"为何对/其它为何错"}}}}}}\n'
    "要求：每题恰 4 个选项、answer 为正确项下标(0-3)、有唯一正确答案、干扰项像样能暴露常见误解；"
    "题目简短聚焦该点；动作/习惯类问要领或判断而非操作；键必须用给定的 id。只输出 JSON。"
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
