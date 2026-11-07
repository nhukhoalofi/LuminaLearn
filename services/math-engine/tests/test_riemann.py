from __future__ import annotations

import pytest

from luminalearn_math_engine.schemas.math_scene import MathSceneValidationError, validate_math_scene
from luminalearn_math_engine.validators.riemann import RiemannValidationError, verify_riemann_scene

RIEMANN_SCENE = {
    "schemaVersion": "math-v1",
    "topicId": "calculus.integral.riemann_sum",
    "visualization": "riemann_sum",
    "function": {"type": "polynomial", "coefficients": [0, 0, 1]},
    "interval": [0, 1],
    "partitions": [4, 8, 16],
    "durationSeconds": 10,
    "fps": 24,
    "width": 720,
    "height": 1280,
}


def test_riemann_integral_and_symbolic_sum() -> None:
    report = verify_riemann_scene(RIEMANN_SCENE)
    assert report["status"] == "verified"
    assert report["integral"] == "1/3"
    assert report["limitAtInfinity"] == "1/3"
    assert report["riemannSumFormula"] == "(n - 1)*(2*n - 1)/(6*n**2)"
    # Numerical samples for partitions 4, 8, 16
    # For n=4: (3)(7)/(6*16) = 21/96 = 0.21875
    assert report["samplePartitions"][4] == 0.21875
    # For n=8: (7)(15)/(6*64) = 105/384 = 0.273438
    assert report["samplePartitions"][8] == 0.273438


def test_riemann_claims_verified_by_sympy() -> None:
    claims = {
        "definite_integral": "1/3",
        "riemann_sum_formula": "(n - 1)*(2*n - 1)/(6*n**2)",
        "riemann_sum_limit": "1/3",
    }
    report = verify_riemann_scene(RIEMANN_SCENE, claims)
    assert report["status"] == "verified"
    assert report["checks"]["definite_integral"]["status"] == "verified"
    assert report["checks"]["riemann_sum_formula"]["status"] == "verified"
    assert report["checks"]["riemann_sum_limit"]["status"] == "verified"


def test_riemann_detects_incorrect_formula_or_integral() -> None:
    wrong_integral = verify_riemann_scene(RIEMANN_SCENE, {"definite_integral": "1/2"})
    assert wrong_integral["status"] == "incorrect"
    assert wrong_integral["checks"]["definite_integral"]["status"] == "incorrect"

    wrong_limit = verify_riemann_scene(RIEMANN_SCENE, {"riemann_sum_limit": "1"})
    assert wrong_limit["status"] == "incorrect"
    assert wrong_limit["checks"]["riemann_sum_limit"]["status"] == "incorrect"


def test_riemann_rejects_invalid_interval() -> None:
    # a >= b
    invalid_interval_scene = {**RIEMANN_SCENE, "interval": [1, 0]}
    with pytest.raises((RiemannValidationError, MathSceneValidationError)):
        verify_riemann_scene(invalid_interval_scene)

    with pytest.raises(MathSceneValidationError):
        validate_math_scene(invalid_interval_scene)


def test_riemann_rejects_invalid_partitions() -> None:
    # empty partitions or non-positive
    with pytest.raises((RiemannValidationError, MathSceneValidationError)):
        verify_riemann_scene({**RIEMANN_SCENE, "partitions": []})

    with pytest.raises((RiemannValidationError, MathSceneValidationError)):
        verify_riemann_scene({**RIEMANN_SCENE, "partitions": [-4]})


def test_riemann_schema_allowlist_validation() -> None:
    validated = validate_math_scene(RIEMANN_SCENE)
    assert validated["visualization"] == "riemann_sum"
    assert validated["topicId"] == "calculus.integral.riemann_sum"
    assert validated["interval"] == [0.0, 1.0]
    assert validated["partitions"] == [4, 8, 16]

    # Rejects unsupported visualization
    with pytest.raises(MathSceneValidationError):
        validate_math_scene({**RIEMANN_SCENE, "visualization": "unsupported_viz"})

