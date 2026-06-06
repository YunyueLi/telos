"""FIRe-style credit / penalty propagation over the prerequisite graph.

Demonstrating mastery of X gives **credit DOWN** to its prerequisites (if you
can do X you most likely know what it builds on). Failing X gives **penalty UP**
to its dependents (you are not ready for what requires X). Propagation decays
with graph distance.
"""
from __future__ import annotations

from collections import deque

from .models import KnowledgeGraph, LearnerState


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def apply_evidence(
    state: LearnerState,
    graph: KnowledgeGraph,
    pid: str,
    correct: bool,
    strength: float = 0.85,
    decay: float = 0.5,
) -> None:
    cur = state.get(pid)
    if correct:
        state.mastery[pid] = _clamp01(cur + strength * (1 - cur))
        _propagate(state, graph, pid, sign=+1, strength=strength, decay=decay)
    else:
        state.mastery[pid] = _clamp01(cur - strength * cur - 0.05)
        _propagate(state, graph, pid, sign=-1, strength=strength, decay=decay)
    state.record({"event": "evidence", "point": pid, "correct": bool(correct)})


def _propagate(
    state: LearnerState,
    graph: KnowledgeGraph,
    pid: str,
    sign: int,
    strength: float,
    decay: float,
) -> None:
    # credit flows to prerequisites; penalty flows to dependents
    start = graph.prerequisites(pid) if sign > 0 else graph.dependents(pid)
    seen: set[str] = set()
    q = deque((x, 1) for x in start)
    while q:
        node, dist = q.popleft()
        if node in seen:
            continue
        seen.add(node)
        amt = strength * (decay ** dist)
        cur = state.get(node)
        if sign > 0:
            state.mastery[node] = _clamp01(cur + amt * (1 - cur))
            nxt = graph.prerequisites(node)
        else:
            state.mastery[node] = _clamp01(cur - amt * cur)
            nxt = graph.dependents(node)
        for x in nxt:
            q.append((x, dist + 1))
