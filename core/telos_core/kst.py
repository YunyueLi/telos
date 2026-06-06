"""Knowledge Space Theory: valid knowledge states and their fringes.

A *knowledge state* is a set of mastered points that is downward-closed under
prerequisites. The **outer fringe** is what can be added while staying valid
(ready-to-learn); the **inner fringe** is what can be removed (review edge).
"""
from __future__ import annotations

from .models import KnowledgeGraph, LearnerState, Status


def is_knowledge_state(graph: KnowledgeGraph, mastered: set[str]) -> bool:
    """True iff `mastered` is downward-closed under prerequisites."""
    for pid in mastered:
        for pre in graph.prerequisites(pid):
            if pre not in mastered:
                return False
    return True


def outer_fringe(graph: KnowledgeGraph, mastered: set[str]) -> set[str]:
    """Not-yet-mastered points whose prerequisites are all mastered."""
    return {
        pid
        for pid in graph.ids()
        if pid not in mastered
        and all(pre in mastered for pre in graph.prerequisites(pid))
    }


def inner_fringe(graph: KnowledgeGraph, mastered: set[str]) -> set[str]:
    """Mastered points with no mastered dependents (the 'just-learned' edge)."""
    return {pid for pid in mastered if not (graph.dependents(pid) & mastered)}


def status_of(
    graph: KnowledgeGraph,
    state: LearnerState,
    pid: str,
    threshold: float = 0.8,
    learning_floor: float = 0.15,
) -> Status:
    m = state.get(pid)
    if m >= threshold:
        return Status.MASTERED
    mastered = state.mastered_ids(threshold)
    ready = all(pre in mastered for pre in graph.prerequisites(pid))
    if not ready:
        return Status.LOCKED
    return Status.LEARNING if m >= learning_floor else Status.LEARNABLE
