"""The three open data standards: Outcome Spec, Knowledge Graph, Learner State."""
from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from enum import Enum
from typing import Iterable, Optional

from .fsrs import Card


class Status(str, Enum):
    LOCKED = "locked"        # a prerequisite is not yet mastered
    LEARNABLE = "learnable"  # outer fringe: ready to learn now
    LEARNING = "learning"    # in progress
    MASTERED = "mastered"


class DomainClass(str, Enum):
    """How a skill is learned — decides diagnosis/复习 strategy. See docs/STRATEGY.md §1."""
    DECLARATIVE = "A"  # 陈述性知识体（词汇/术语/法条）—— BKT+FSRS 最适用
    PROCEDURAL = "B"   # 良构程序性/算法（数学/编程）—— 强 DAG，默认
    CREATIVE = "C"     # 病构/创造性（写作/设计）—— BKT 降级为前置探测
    MOTOR = "D"        # 闭环动作（乐器/书法）—— 表现性评估，不用 FSRS
    PERFORMANCE = "E"  # 开放/对抗性表现（电竞/辩论）
    AFFECTIVE = "F"    # 情感/社会/习惯 —— 打卡而非遗忘曲线


def coerce_domain(x) -> "DomainClass":
    if isinstance(x, DomainClass):
        return x
    try:
        return DomainClass(str(x).strip().upper())
    except ValueError:
        return DomainClass.PROCEDURAL


# 哪些大类适合用 FSRS 间隔复习（A 事实主场；B 概念/公式；C 脚手架；E 知识层）。
# D 动作 / F 习惯不走遗忘曲线（应换成练习 session 调度 / 打卡，后续阶段实现）。
_FSRS_DOMAINS = {DomainClass.DECLARATIVE, DomainClass.PROCEDURAL, DomainClass.CREATIVE, DomainClass.PERFORMANCE}


def uses_fsrs(domain: "DomainClass") -> bool:
    return coerce_domain(domain) in _FSRS_DOMAINS


@dataclass(frozen=True)
class KnowledgePoint:
    id: str
    name: str
    prerequisites: tuple[str, ...] = ()
    is_goal: bool = False
    tags: tuple[str, ...] = ()
    minutes: int = 25  # estimated time-to-learn
    domain: DomainClass = DomainClass.PROCEDURAL  # 学习机制大类，决定诊断/复习策略
    desc: str = ""  # can-do：在什么条件下能做到什么（UI 用，可空）
    drill: str = ""  # 怎么刻意练习这一项（具体方法/反馈/加难）
    benchmark: str = ""  # 量化或可观测的达标线（新手/进阶/精英）
    module: str = ""  # 所属模块/阶段 id（层级化倒推：把图谱按学科模块成体系组织）
    module_title: str = ""  # 模块标题（UI 分带/分组显示用）


@dataclass(frozen=True)
class OutcomeSpec:
    """A structured learning goal — the reverse-derivation target."""
    goal: str
    target_ids: tuple[str, ...] = ()
    deadline_days: Optional[int] = None
    bar: str = "能独立做出"


@dataclass
class KnowledgeGraph:
    """A prerequisite DAG of knowledge points."""
    points: dict[str, KnowledgePoint]

    def __post_init__(self) -> None:
        self._dependents: dict[str, set[str]] = {pid: set() for pid in self.points}
        for p in self.points.values():
            for pre in p.prerequisites:
                if pre not in self.points:
                    raise ValueError(f"{p.id!r} requires unknown prerequisite {pre!r}")
                self._dependents[pre].add(p.id)
        self.topological_order()  # raises ValueError on a cycle

    @classmethod
    def from_spec(cls, rows: Iterable[tuple]) -> "KnowledgeGraph":
        """rows: (id, name, prerequisites[, is_goal[, minutes[, domain[, desc[, drill[, benchmark[, module[, module_title]]]]]]]])"""
        pts: dict[str, KnowledgePoint] = {}
        for row in rows:
            pid, name, prereqs = row[0], row[1], tuple(row[2])
            is_goal = bool(row[3]) if len(row) > 3 else False
            minutes = int(row[4]) if len(row) > 4 else 25
            domain = coerce_domain(row[5]) if len(row) > 5 else DomainClass.PROCEDURAL
            desc = str(row[6]) if len(row) > 6 else ""
            drill = str(row[7]) if len(row) > 7 else ""
            benchmark = str(row[8]) if len(row) > 8 else ""
            module = str(row[9]) if len(row) > 9 else ""
            module_title = str(row[10]) if len(row) > 10 else ""
            pts[pid] = KnowledgePoint(
                pid, name, prereqs, is_goal, minutes=minutes, domain=domain,
                desc=desc, drill=drill, benchmark=benchmark, module=module, module_title=module_title,
            )
        return cls(pts)

    def __contains__(self, pid: str) -> bool:
        return pid in self.points

    def __getitem__(self, pid: str) -> KnowledgePoint:
        return self.points[pid]

    def __iter__(self):
        return iter(self.points.values())

    def ids(self) -> list[str]:
        return list(self.points.keys())

    def prerequisites(self, pid: str) -> tuple[str, ...]:
        return self.points[pid].prerequisites

    def dependents(self, pid: str) -> set[str]:
        return set(self._dependents[pid])

    def ancestors(self, pid: str) -> set[str]:
        """All transitive prerequisites."""
        seen: set[str] = set()
        stack = list(self.points[pid].prerequisites)
        while stack:
            x = stack.pop()
            if x in seen:
                continue
            seen.add(x)
            stack.extend(self.points[x].prerequisites)
        return seen

    def descendants(self, pid: str) -> set[str]:
        """All transitive dependents."""
        seen: set[str] = set()
        stack = list(self._dependents[pid])
        while stack:
            x = stack.pop()
            if x in seen:
                continue
            seen.add(x)
            stack.extend(self._dependents[x])
        return seen

    def goals(self) -> list[str]:
        return [p.id for p in self.points.values() if p.is_goal]

    def topological_order(self) -> list[str]:
        indeg = {pid: len(self.points[pid].prerequisites) for pid in self.points}
        q = deque(pid for pid, d in indeg.items() if d == 0)
        order: list[str] = []
        while q:
            x = q.popleft()
            order.append(x)
            for dep in self._dependents[x]:
                indeg[dep] -= 1
                if indeg[dep] == 0:
                    q.append(dep)
        if len(order) != len(self.points):
            raise ValueError("knowledge graph has a cycle")
        return order


@dataclass
class LearnerState:
    """Single-writer, versioned learner state."""
    mastery: dict[str, float] = field(default_factory=dict)  # id -> [0,1]
    cards: dict[str, Card] = field(default_factory=dict)     # id -> FSRS card
    day: int = 0                                             # current day index
    version: int = 0
    history: list[dict] = field(default_factory=list)

    def get(self, pid: str) -> float:
        return self.mastery.get(pid, 0.0)

    def is_mastered(self, pid: str, threshold: float = 0.8) -> bool:
        return self.get(pid) >= threshold

    def mastered_ids(self, threshold: float = 0.8) -> set[str]:
        return {pid for pid, m in self.mastery.items() if m >= threshold}

    def record(self, event: dict) -> None:
        self.version += 1
        self.history.append({"v": self.version, "day": self.day, **event})
