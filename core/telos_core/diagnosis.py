"""Adaptive diagnosis — locate the learner's knowledge state efficiently.

Each step asks the *most uncertain* point (belief closest to 0.5). Every answer
updates that belief (a guess/slip Bayesian model) and propagates through the
prerequisite structure: a correct answer raises belief in prerequisites; a wrong
answer lowers belief in dependents. Stops when confident or out of budget —
inspired by ALEKS-style Markovian assessment.
"""
from __future__ import annotations

from .models import KnowledgeGraph

SLIP = 0.1   # P(wrong | mastered)
GUESS = 0.2  # P(correct | not mastered)


class Diagnosis:
    def __init__(self, graph: KnowledgeGraph, budget: int = 25, prior: float = 0.5):
        self.g = graph
        self.budget = budget
        self.belief: dict[str, float] = {pid: prior for pid in graph.ids()}
        self.asked: set[str] = set()
        self.answers: dict[str, bool] = {}

    @staticmethod
    def _bayes(b: float, correct: bool) -> float:
        if correct:
            num = (1 - SLIP) * b
            den = num + GUESS * (1 - b)
        else:
            num = SLIP * b
            den = num + (1 - GUESS) * (1 - b)
        return num / den if den > 0 else b

    def next_question(self) -> str | None:
        best, best_u = None, 1.0
        for pid in self.g.ids():
            if pid in self.asked:
                continue
            u = abs(self.belief[pid] - 0.5)
            if u < best_u:
                best, best_u = pid, u
        if best is None or len(self.asked) >= self.budget or best_u > 0.45:
            return None
        return best

    def answer(self, pid: str, correct: bool) -> None:
        self.asked.add(pid)
        self.answers[pid] = bool(correct)
        self.belief[pid] = self._bayes(self.belief[pid], correct)
        if correct:
            for a in self.g.ancestors(pid):
                self.belief[a] = max(self.belief[a], self._bayes(self.belief[a], True))
        else:
            for d in self.g.descendants(pid):
                self.belief[d] = min(self.belief[d], self._bayes(self.belief[d], False))

    def is_done(self) -> bool:
        return self.next_question() is None

    def beliefs(self) -> dict[str, float]:
        return dict(self.belief)

    def mastered(self, threshold: float = 0.5) -> set[str]:
        return {pid for pid, b in self.belief.items() if b >= threshold}
