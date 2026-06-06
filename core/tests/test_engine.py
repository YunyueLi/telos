from telos_core.engine import TelosEngine
from telos_core.fsrs import GOOD
from telos_core.seed import fastapi_jwt_graph, true_oracle


def test_full_loop():
    g = fastapi_jwt_graph()
    eng = TelosEngine(g)
    state = eng.diagnose(true_oracle(), budget=25)

    prog = eng.progress(state)
    assert "jwt" in prog["frontier"]          # the frontier surfaces JWT 原理
    assert prog["mastered"] == 3              # py / types / http

    eng.record_result(state, "jwt", correct=True, grade=GOOD)
    assert state.is_mastered("jwt")

    prog2 = eng.progress(state)
    assert "route" in prog2["frontier"]       # FastAPI 路由 unlocked by JWT
    assert "jwt" in state.cards               # entered the FSRS review cycle
    assert state.version > 0
    assert not prog2["goals_reached"]


def test_reviews_become_due_over_time():
    g = fastapi_jwt_graph()
    eng = TelosEngine(g)
    state = eng.diagnose(true_oracle(), budget=25)
    assert eng.recommend(state)["review"] == []  # nothing due on day 0
    state.day = 30
    due_ids = [pid for pid, _ in eng.recommend(state)["review"]]
    assert "py" in due_ids  # retrievability has decayed past 0.9
