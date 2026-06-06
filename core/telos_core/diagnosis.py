"""Adaptive diagnosis — BKT belief tracking + information-gain question selection.

Each skill carries a BKT belief P(known). At every step we ask the skill whose
answer is expected to reduce uncertainty the most (maximum expected Shannon
information gain). Answers Bayes-update the belief and propagate through the
prerequisite structure (a correct answer implies prerequisites; a wrong one
implies dependents are not yet reachable). Inspired by ALEKS-style assessment.
"""
from __future__ import annotations

from .bkt import BKTParams, binary_entropy, posterior, predict_correct, update_belief
from .models import KnowledgeGraph


class Diagnosis:
    def __init__(self, graph: KnowledgeGraph, budget: int = 25, params: BKTParams | None = None):
        self.g = graph
        self.budget = budget
        self.prm = params or BKTParams()
        self.belief: dict[str, float] = {pid: self.prm.p_l0 for pid in graph.ids()}
        self.asked: set[str] = set()
        self.answers: dict[str, bool] = {}

    def _info_gain(self, pid: str) -> float:
        """Expected reduction in Bernoulli entropy from asking `pid`."""
        b = self.belief[pid]
        pc = predict_correct(b, self.prm)
        h_now = binary_entropy(b)
        h_correct = binary_entropy(posterior(b, True, self.prm))
        h_wrong = binary_entropy(posterior(b, False, self.prm))
        return h_now - (pc * h_correct + (1 - pc) * h_wrong)

    def next_question(self) -> str | None:
        best, best_ig = None, -1.0
        for pid in self.g.ids():
            if pid in self.asked:
                continue
            ig = self._info_gain(pid)
            if ig > best_ig:
                best, best_ig = pid, ig
        if best is None or len(self.asked) >= self.budget or best_ig < 1e-3:
            return None
        return best

    def answer(self, pid: str, correct: bool) -> None:
        self.asked.add(pid)
        self.answers[pid] = bool(correct)
        self.belief[pid] = update_belief(self.belief[pid], correct, self.prm)
        if correct:
            for a in self.g.ancestors(pid):
                self.belief[a] = max(self.belief[a], posterior(self.belief[a], True, self.prm))
        else:
            for d in self.g.descendants(pid):
                self.belief[d] = min(self.belief[d], posterior(self.belief[d], False, self.prm))

    def is_done(self) -> bool:
        return self.next_question() is None

    def beliefs(self) -> dict[str, float]:
        return dict(self.belief)

    def mastered(self, threshold: float = 0.6) -> set[str]:
        return {pid for pid, b in self.belief.items() if b >= threshold}
