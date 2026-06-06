from telos_core import fsrs
from telos_core.fsrs import AGAIN, GOOD, Card, interval, retrievability, review


def test_init_good():
    c = review(Card(), GOOD, day=0)
    assert abs(c.stability - fsrs.DEFAULT_W[2]) < 1e-9
    assert 1.0 <= c.difficulty <= 10.0
    assert c.reps == 1 and c.state == "review"


def test_retrievability_decreases():
    s = 10.0
    assert retrievability(s, 0) == 1.0
    assert retrievability(s, 1) > retrievability(s, 10) > retrievability(s, 100) > 0


def test_interval_near_stability_at_90():
    s = 12.3
    assert abs(interval(s, 0.9) - s) < 0.5  # by definition of stability


def test_good_review_grows_stability():
    c = review(Card(), GOOD, day=0)
    c2 = review(c, GOOD, day=max(1, int(interval(c.stability))))
    assert c2.stability > c.stability


def test_lapse_shrinks_stability():
    c = review(Card(), GOOD, day=0)
    c = review(c, GOOD, day=10)
    before = c.stability
    c2 = review(c, AGAIN, day=20)
    assert c2.stability <= before
    assert c2.lapses == 1
