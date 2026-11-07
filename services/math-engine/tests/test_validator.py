from __future__ import annotations

import pytest

from luminalearn_math_engine.schemas.math_scene import MathSceneValidationError, validate_math_scene
from luminalearn_math_engine.validators.derivative import verify_derivative_scene


SCENE = {
    "schemaVersion": "math-v1", "topicId": "calculus.derivative.intuition",
    "visualization": "secant_to_tangent", "function": {"type": "polynomial", "coefficients": [0, 0, 1]},
    "pointX": 1, "hStart": 2, "hEnd": 0.05, "durationSeconds": 8, "fps": 24, "width": 720, "height": 1280,
}


def test_x_squared_derivative_and_value_at_one() -> None:
    report = verify_derivative_scene(SCENE)
    assert report["derivative"] == "2*x"
    assert report["slopeAtPoint"] == 2


def test_secant_slope_and_limit() -> None:
    report = verify_derivative_scene(SCENE)
    assert report["secantSlope"] == "h + 2"
    assert report["limitAtZero"] == "2"


def test_claims_are_compared_by_sympy_and_wrong_formula_is_detected() -> None:
    verified = verify_derivative_scene(SCENE, {"derivative": "2*x", "secantSlope": "2+h", "limitAtZero": "2", "slopeAtPoint": "2"})
    assert verified["status"] == "verified"
    wrong = verify_derivative_scene(SCENE, {"derivative": "3*x"})
    assert wrong["status"] == "incorrect"
    assert wrong["checks"]["derivative"]["status"] == "incorrect"


def test_unknown_claim_needs_review() -> None:
    report = verify_derivative_scene(SCENE, {"integral": "1"})
    assert report["status"] == "needs_review"


def test_expression_parser_rejects_code() -> None:
    report = verify_derivative_scene(SCENE, {"derivative": "__import__('os')"})
    assert report["checks"]["derivative"]["status"] == "rejected"


def test_function_graph_contract_does_not_require_secant_parameters() -> None:
    graph = {key: value for key, value in SCENE.items() if key not in {"hStart", "hEnd"}}
    graph["visualization"] = "function_graph"
    assert validate_math_scene(graph)["visualization"] == "function_graph"


@pytest.mark.parametrize("change", [
    {"function": {"type": "expression", "coefficients": [0, 0, 1]}},
    {"hEnd": 0}, {"visualization": "arbitrary_python"}, {"width": 4000}, {"scriptPath": "bad.py"},
])
def test_scene_allowlist_and_limits(change: dict[str, object]) -> None:
    with pytest.raises(MathSceneValidationError):
        validate_math_scene({**SCENE, **change})

