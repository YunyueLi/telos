"""TelosEngine — orchestrates the backward-design learning loop."""
from __future__ import annotations

from typing import Callable

from . import fire, frontier, kst
from .diagnosis import Diagnosis
from .fsrs import GOOD, Card, review
from .models import KnowledgeGraph, LearnerState, Status


class TelosEngine:
    def __init__(self, graph: KnowledgeGraph):
        self.graph = graph

    def diagnose(
        self, oracle: Callable[[str], bool], budget: int = 25, known_threshold: float = 0.6
    ) -> LearnerState:
        """Run adaptive (BKT + information-gain) diagnosis using `oracle(point_id) -> bool`."""
        d = Diagnosis(self.graph, budget=budget)
        n = 0
        while True:
            q = d.next_question()
            if q is None:
                break
            d.answer(q, bool(oracle(q)))
            n += 1
        state = LearnerState()
        for pid, b in d.beliefs().items():
            # crisp KST knowledge state: a point judged known enters the state as mastered
            state.mastery[pid] = 0.9 if b >= known_threshold else b
        for pid in d.mastered(known_threshold):
            state.cards[pid] = review(Card(), GOOD, day=0)
        state.record({"event": "diagnosis", "questions": n})
        return state

    def status(self, state: LearnerState, pid: str, threshold: float = 0.8) -> Status:
        return kst.status_of(self.graph, state, pid, threshold)

    def frontier(self, state: LearnerState, threshold: float = 0.8):
        return frontier.learning_frontier(self.graph, state, threshold)

    def recommend(self, state: LearnerState, threshold: float = 0.8) -> dict:
        return frontier.recommend(self.graph, state, threshold)

    def record_result(
        self,
        state: LearnerState,
        pid: str,
        correct: bool,
        grade: int = GOOD,
        threshold: float = 0.8,
    ) -> LearnerState:
        """Record a teach/verify outcome: FIRe propagation + FSRS scheduling."""
        fire.apply_evidence(state, self.graph, pid, correct)
        card = state.cards.get(pid, Card())
        state.cards[pid] = review(card, grade if correct else 1, day=state.day)
        return state

    def progress(self, state: LearnerState, threshold: float = 0.8) -> dict:
        mastered = state.mastered_ids(threshold)
        return {
            "mastered": len(mastered),
            "total": len(self.graph.points),
            "frontier": [pid for pid, _ in self.frontier(state, threshold)],
            "due": [pid for pid, _ in frontier.due_reviews(self.graph, state, threshold)],
            "goals_reached": all(state.is_mastered(g, threshold) for g in self.graph.goals()),
        }
