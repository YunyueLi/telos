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


@dataclass(frozen=True)
class KnowledgePoint:
    id: str
    name: str
    prerequisites: tuple[str, ...] = ()
    is_goal: bool = False
    tags: tuple[str, ...] = ()
    minutes: int = 25  # estimated time-to-learn


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
        """rows: (id, name, prerequisites[, is_goal[, minutes]])"""
        pts: dict[str, KnowledgePoint] = {}
        for row in rows:
            pid, name, prereqs = row[0], row[1], tuple(row[2])
            is_goal = bool(row[3]) if len(row) > 3 else False
            minutes = int(row[4]) if len(row) > 4 else 25
            pts[pid] = KnowledgePoint(pid, name, prereqs, is_goal, minutes=minutes)
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
