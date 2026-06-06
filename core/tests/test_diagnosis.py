from telos_core.engine import TelosEngine
from telos_core.seed import fastapi_jwt_graph


def test_recovers_known_state():
    g = fastapi_jwt_graph()
    eng = TelosEngine(g)
    truth = {"py", "types", "http"}
    state = eng.diagnose(lambda pid: pid in truth, budget=25)
    recovered = {pid for pid in g.ids() if state.get(pid) >= 0.5}
    assert {"py", "types", "http"} <= recovered
    assert "deploy" not in recovered and "route" not in recovered and "jwt" not in recovered
