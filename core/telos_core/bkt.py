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


# 按学习机制大类(DomainClass A–F)预设 BKT 参数。依据见 docs/STRATEGY.md §1：
# A 事实：转移快、按题型猜对率高；B 程序：程序化后失误低；
# C 创造/E 表现：观测噪声大(BKT 在此降级为前置探测)；D 动作：几乎不可能"猜对"。
DOMAIN_BKT: dict[str, BKTParams] = {
    "A": BKTParams(p_l0=0.20, p_t=0.20, p_s=0.08, p_g=0.25),
    "B": BKTParams(p_l0=0.25, p_t=0.12, p_s=0.05, p_g=0.20),
    "C": BKTParams(p_l0=0.30, p_t=0.10, p_s=0.15, p_g=0.20),
    "D": BKTParams(p_l0=0.15, p_t=0.12, p_s=0.10, p_g=0.02),
    "E": BKTParams(p_l0=0.20, p_t=0.10, p_s=0.15, p_g=0.05),
    "F": BKTParams(p_l0=0.30, p_t=0.10, p_s=0.10, p_g=0.10),
}


def params_for(domain) -> BKTParams:
    """取某大类的 BKT 参数。domain 可为 DomainClass 或其字符串值('A'..'F')。"""
    key = getattr(domain, "value", domain)
    return DOMAIN_BKT.get(str(key).strip().upper(), BKTParams())


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
