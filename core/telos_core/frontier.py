"""The learning frontier (ZPD): what to learn and what to review next."""
from __future__ import annotations

from . import kst
from .fsrs import retrievability
from .models import KnowledgeGraph, LearnerState


def learning_frontier(
    graph: KnowledgeGraph, state: LearnerState, threshold: float = 0.8
) -> list[tuple[str, int]]:
    """Outer-fringe points ranked by how much they unlock (descendants + goal pull)."""
    mastered = state.mastered_ids(threshold)
    goals = set(graph.goals())
    scored: list[tuple[str, int]] = []
    for pid in kst.outer_fringe(graph, mastered):
        unlocking = len(graph.descendants(pid))
        toward_goal = 1 if (graph[pid].is_goal or (graph.descendants(pid) & goals)) else 0
        scored.append((pid, unlocking + toward_goal))
    scored.sort(key=lambda t: (-t[1], t[0]))
    return scored


def due_reviews(
    graph: KnowledgeGraph,
    state: LearnerState,
    threshold: float = 0.8,
    request_retention: float = 0.9,
) -> list[tuple[str, float]]:
    """Mastered points whose retrievability has fallen below the target."""
    due: list[tuple[str, float]] = []
    for pid in state.mastered_ids(threshold):
        card = state.cards.get(pid)
        if card is None:
            continue
        elapsed = max(0, state.day - card.last_review_day)
        r = retrievability(card.stability, elapsed)
        if r < request_retention:
            due.append((pid, r))
    due.sort(key=lambda t: t[1])  # most urgent (lowest R) first
    return due


def recommend(
    graph: KnowledgeGraph, state: LearnerState, threshold: float = 0.8
) -> dict:
    return {
        "learn": learning_frontier(graph, state, threshold),
        "review": due_reviews(graph, state, threshold),
    }
