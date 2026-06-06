"""FSRS-4.5 spaced-repetition scheduler.

Each card tracks Difficulty (D, 1..10), Stability (S, days) and, derived from
elapsed time, Retrievability (R, probability of recall). Reviews update D and S;
the next interval is the time until R decays to the requested retention.

Reference: github.com/open-spaced-repetition/fsrs4anki (DSR model).
"""
from __future__ import annotations

import math
from dataclasses import dataclass

DECAY = -0.5
FACTOR = 19 / 81  # == 0.9 ** (1 / DECAY) - 1

# FSRS-4.5 default weights (w0..w16)
DEFAULT_W = (
    0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49,
    0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61,
)

# review grades
AGAIN, HARD, GOOD, EASY = 1, 2, 3, 4


@dataclass
class Card:
    stability: float = 0.0
    difficulty: float = 0.0
    reps: int = 0
    lapses: int = 0
    last_review_day: int = 0
    state: str = "new"  # "new" | "review"


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def retrievability(stability: float, elapsed_days: float) -> float:
    """Probability of recall after `elapsed_days` given `stability`."""
    if stability <= 0:
        return 0.0
    return (1 + FACTOR * max(0.0, elapsed_days) / stability) ** DECAY


def interval(stability: float, request_retention: float = 0.9) -> float:
    """Days until retrievability decays to `request_retention` (≈ stability at 0.9)."""
    return (stability / FACTOR) * (request_retention ** (1 / DECAY) - 1)


def _init_stability(w, grade: int) -> float:
    return max(0.1, w[grade - 1])


def _init_difficulty(w, grade: int) -> float:
    return _clamp(w[4] - w[5] * (grade - 3), 1.0, 10.0)


def _next_difficulty(w, d: float, grade: int) -> float:
    target = _init_difficulty(w, EASY)
    nd = d - w[6] * (grade - 3)
    nd = w[7] * target + (1 - w[7]) * nd  # mean reversion
    return _clamp(nd, 1.0, 10.0)


def _stability_after_recall(w, d: float, s: float, r: float, grade: int) -> float:
    hard = w[15] if grade == HARD else 1.0
    easy = w[16] if grade == EASY else 1.0
    return s * (
        1
        + math.exp(w[8])
        * (11 - d)
        * (s ** -w[9])
        * (math.exp(w[10] * (1 - r)) - 1)
        * hard
        * easy
    )


def _stability_after_lapse(w, d: float, s: float, r: float) -> float:
    sf = w[11] * (d ** -w[12]) * ((s + 1) ** w[13] - 1) * math.exp(w[14] * (1 - r))
    return min(sf, s)  # a lapse never increases stability


def review(card: Card, grade: int, day: int, w=DEFAULT_W) -> Card:
    """Return a new Card after reviewing on `day` with `grade` (1..4)."""
    grade = int(grade)
    if card.reps == 0 or card.state == "new":
        s = _init_stability(w, grade)
        d = _init_difficulty(w, grade)
        lapses = 1 if grade == AGAIN else 0
    else:
        elapsed = max(0, day - card.last_review_day)
        r = retrievability(card.stability, elapsed)
        d = _next_difficulty(w, card.difficulty, grade)
        if grade == AGAIN:
            s = _stability_after_lapse(w, d, card.stability, r)
            lapses = card.lapses + 1
        else:
            s = _stability_after_recall(w, d, card.stability, r, grade)
            lapses = card.lapses
    return Card(
        stability=max(0.1, s),
        difficulty=d,
        reps=card.reps + 1,
        lapses=lapses,
        last_review_day=day,
        state="review",
    )
