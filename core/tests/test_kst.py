from telos_core import kst
from telos_core.seed import fastapi_jwt_graph


def test_outer_fringe():
    g = fastapi_jwt_graph()
    mastered = {"py", "types", "http"}
    of = kst.outer_fringe(g, mastered)
    assert "jwt" in of      # http + types mastered -> ready
    assert "rest" in of     # http mastered -> ready
    assert "route" not in of  # needs jwt
    assert "deploy" not in of


def test_valid_state():
    g = fastapi_jwt_graph()
    assert kst.is_knowledge_state(g, {"py", "types", "http"})
    assert not kst.is_knowledge_state(g, {"jwt"})  # prerequisites missing


def test_inner_fringe():
    g = fastapi_jwt_graph()
    mastered = {"py", "types", "http"}
    inner = kst.inner_fringe(g, mastered)
    assert "types" in inner and "http" in inner  # no mastered dependents
    assert "py" not in inner                      # types/http (mastered) depend on it
