from telos_core.bkt import DOMAIN_BKT, BKTParams, params_for
from telos_core.engine import TelosEngine
from telos_core.models import DomainClass, KnowledgeGraph, uses_fsrs


def test_params_for_by_domain():
    assert params_for("A").p_g == 0.25                  # 选择题猜对率高
    assert params_for(DomainClass.MOTOR).p_g == 0.02    # 动作几乎不能"猜对"
    assert params_for(DomainClass.PROCEDURAL) == DOMAIN_BKT["B"]
    assert params_for("not-a-domain") == BKTParams()    # 未知大类回退默认


def test_uses_fsrs_by_domain():
    assert uses_fsrs(DomainClass.DECLARATIVE)
    assert uses_fsrs("B") and uses_fsrs("C") and uses_fsrs("E")
    assert not uses_fsrs(DomainClass.MOTOR)
    assert not uses_fsrs("F")


def test_from_spec_parses_domain():
    g = KnowledgeGraph.from_spec([
        ("a", "记单词", (), False, 10, "A"),
        ("b", "做题", ("a",), True, 20),  # 省略 domain → 默认 B
    ])
    assert g["a"].domain == DomainClass.DECLARATIVE
    assert g["b"].domain == DomainClass.PROCEDURAL


def test_motor_skills_skip_fsrs_but_still_master():
    # A=乐理术语(走 FSRS)、D=动作(不走遗忘曲线)
    g = KnowledgeGraph.from_spec([
        ("terms", "乐理术语", (), False, 15, "A"),
        ("scales", "音阶练习", ("terms",), False, 20, "D"),
        ("piece", "完整弹一首", ("scales",), True, 30, "D"),
    ])
    eng = TelosEngine(g)
    state = eng.diagnose(lambda pid: True, budget=25)  # 全都会
    assert state.is_mastered("piece")        # 掌握度照常推进
    assert "terms" in state.cards            # A 类进入间隔复习
    assert "scales" not in state.cards       # D 类不进遗忘曲线
    assert "piece" not in state.cards
    # record_result 同样门控
    eng.record_result(state, "piece", correct=True)
    assert "piece" not in state.cards
