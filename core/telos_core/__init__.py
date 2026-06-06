"""Telos core — a portable, dependency-free backward-design learning engine.

Pipeline: Outcome Spec → Knowledge Graph → adaptive Diagnosis → Learner State
→ learning Frontier (KST/ZPD) → teach/verify → FIRe credit propagation
→ FSRS spaced review → loop.
"""

from .models import (
    Status,
    KnowledgePoint,
    KnowledgeGraph,
    OutcomeSpec,
    LearnerState,
)
from .fsrs import Card, review, retrievability, interval, AGAIN, HARD, GOOD, EASY
from .diagnosis import Diagnosis
from .engine import TelosEngine
from . import kst, fire, frontier, seed

__all__ = [
    "Status",
    "KnowledgePoint",
    "KnowledgeGraph",
    "OutcomeSpec",
    "LearnerState",
    "Card",
    "review",
    "retrievability",
    "interval",
    "AGAIN",
    "HARD",
    "GOOD",
    "EASY",
    "Diagnosis",
    "TelosEngine",
    "kst",
    "fire",
    "frontier",
    "seed",
]

__version__ = "0.1.0"
