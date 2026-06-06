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
