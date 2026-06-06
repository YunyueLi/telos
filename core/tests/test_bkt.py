from telos_core.bkt import (
    BKTParams,
    binary_entropy,
    posterior,
    predict_correct,
    update_belief,
)


def test_posterior_moves_with_evidence():
    prm = BKTParams()
    b = prm.p_l0
    assert posterior(b, True, prm) > b > posterior(b, False, prm)


def test_predict_bounds():
    prm = BKTParams()
    assert predict_correct(0.0, prm) == prm.p_g            # all guess when unknown
    assert abs(predict_correct(1.0, prm) - (1 - prm.p_s)) < 1e-9  # 1 - slip when known


def test_update_transition():
    prm = BKTParams()
    b = prm.p_l0
    assert update_belief(b, True, prm) > b   # a correct answer raises belief
    assert 0.0 <= update_belief(b, False, prm) <= 1.0


def test_entropy_peaks_at_half():
    assert binary_entropy(0.5) == 1.0
    assert binary_entropy(0.0) == 0.0 and binary_entropy(1.0) == 0.0
    assert binary_entropy(0.5) > binary_entropy(0.1)
