"""Bayesian Knowledge Tracing (Corbett & Anderson, 1995) — a 2-state HMM per skill.

Each skill has a latent "known / not-known" state. Four parameters govern it:
prior P(known), transit P(learn per opportunity), slip P(wrong|known),
guess P(correct|not-known). After each observed response we Bayes-update the
belief, then apply the learning transition.
"""
from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass(frozen=True)
class BKTParams:
    p_l0: float = 0.25  # P(known) prior
    p_t: float = 0.15   # P(learn) per opportunity
    p_s: float = 0.10   # P(slip | known)
    p_g: float = 0.20   # P(guess | not known)


def posterior(p_known: float, correct: bool, prm: BKTParams = BKTParams()) -> float:
    """P(known | observation), by Bayes' rule."""
    if correct:
        num = p_known * (1 - prm.p_s)
        den = num + (1 - p_known) * prm.p_g
    else:
        num = p_known * prm.p_s
        den = num + (1 - p_known) * (1 - prm.p_g)
    return num / den if den > 0 else p_known


def update_belief(p_known: float, correct: bool, prm: BKTParams = BKTParams()) -> float:
    """Posterior followed by the learning transition: P(L+1) = post + (1-post)·p_t."""
    post = posterior(p_known, correct, prm)
    return post + (1 - post) * prm.p_t


def predict_correct(p_known: float, prm: BKTParams = BKTParams()) -> float:
    """P(next response is correct)."""
    return p_known * (1 - prm.p_s) + (1 - p_known) * prm.p_g


def binary_entropy(p: float) -> float:
    """Shannon entropy (bits) of a Bernoulli(p)."""
    if p <= 0 or p >= 1:
        return 0.0
    return -(p * math.log2(p) + (1 - p) * math.log2(1 - p))
