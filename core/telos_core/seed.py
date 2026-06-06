"""Seed example: the FastAPI + JWT knowledge graph (matches the web demo)."""
from __future__ import annotations

from typing import Callable

from .models import KnowledgeGraph, OutcomeSpec

# (id, name, prerequisites, is_goal, minutes)
_ROWS = [
    ("py",     "Python 基础",   (),               False, 30),
    ("types",  "函数与类型",     ("py",),          False, 25),
    ("http",   "HTTP 基础",     ("py",),          False, 25),
    ("jwt",    "JWT 原理",      ("http", "types"), False, 25),
    ("rest",   "REST 设计",     ("http",),        False, 30),
    ("route",  "FastAPI 路由",  ("jwt",),         False, 30),
    ("mw",     "鉴权中间件",     ("jwt", "rest"),  False, 35),
    ("deploy", "部署上线",      ("route", "mw"),  True,  40),
]

DEFAULT_MASTERED = {"py", "types", "http"}


def fastapi_jwt_graph() -> KnowledgeGraph:
    return KnowledgeGraph.from_spec(_ROWS)


def fastapi_jwt_spec() -> OutcomeSpec:
    return OutcomeSpec(
        goal="用 FastAPI 写一个带 JWT 鉴权的 REST API，并部署上线",
        target_ids=("deploy",),
        deadline_days=14,
    )


def true_oracle(mastered: set[str] = DEFAULT_MASTERED) -> Callable[[str], bool]:
    """An oracle for simulating diagnosis: answers correctly iff truly mastered."""
    return lambda pid: pid in mastered
