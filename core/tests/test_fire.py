from telos_core import fire
from telos_core.models import LearnerState
from telos_core.seed import fastapi_jwt_graph


def test_credit_flows_down_to_prerequisites():
    g = fastapi_jwt_graph()
    s = LearnerState()
    fire.apply_evidence(s, g, "jwt", correct=True)
    assert s.get("jwt") > 0.8
    assert s.get("http") > 0 and s.get("types") > 0  # direct prerequisites
    assert s.get("py") > 0                            # distance-2 ancestor (decayed)


def test_penalty_flows_up_to_dependents():
    g = fastapi_jwt_graph()
    s = LearnerState()
    s.mastery["mw"] = 0.5
    s.mastery["deploy"] = 0.5
    fire.apply_evidence(s, g, "jwt", correct=False)
    assert s.get("mw") < 0.5 and s.get("deploy") < 0.5
