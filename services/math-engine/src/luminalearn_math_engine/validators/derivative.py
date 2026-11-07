from __future__ import annotations

from typing import Any

import sympy as sp

from ..schemas.math_scene import validate_math_scene
from .safe_expression import UnsafeExpressionError, parse_bounded_expression


def _polynomial(coefficients: list[float], x: sp.Symbol) -> sp.Expr:
    return sp.Add(*(sp.Rational(str(coefficient)) * x ** power for power, coefficient in enumerate(coefficients)))


def verify_derivative_scene(scene: dict[str, Any], claims: dict[str, str] | None = None) -> dict[str, Any]:
    safe = validate_math_scene(scene)
    x, h = sp.symbols("x h", real=True)
    expression = _polynomial(safe["function"]["coefficients"], x)
    point = sp.Rational(str(safe["pointX"]))
    derivative = sp.diff(expression, x)
    secant = sp.cancel((expression.subs(x, point + h) - expression.subs(x, point)) / h)
    slope_limit = sp.limit(secant, h, 0)
    slope_at_point = sp.simplify(derivative.subs(x, point))

    expected = {
        "derivative": derivative,
        "polynomial_derivative": derivative,
        "secantSlope": secant,
        "secant_slope": secant,
        "limitAtZero": slope_limit,
        "limit_at_zero": slope_limit,
        "slopeAtPoint": slope_at_point,
        "slope_at_point": slope_at_point,
        "value_at_point": slope_at_point,
        "valueAtPoint": slope_at_point,
    }
    checks: dict[str, dict[str, Any]] = {}
    status = "verified"
    if claims:
        for key, actual in claims.items():
            if key not in expected:
                checks[key] = {"status": "needs_review", "reason": "No validator is registered for this claim"}
                status = "needs_review" if status == "verified" else status
                continue
            try:
                claimed = parse_bounded_expression(actual, {"x": x, "h": h})
                verified = sp.simplify(claimed - expected[key]) == 0
                checks[key] = {"status": "verified" if verified else "incorrect", "expected": str(expected[key]), "received": str(claimed)}
                if not verified: status = "incorrect"
            except UnsafeExpressionError as error:
                checks[key] = {"status": "rejected", "reason": str(error)}
                status = "incorrect"

    return {
        "status": status,
        "topicId": safe["topicId"],
        "expression": str(expression),
        "derivative": str(derivative),
        "pointX": float(point),
        "valueAtPoint": str(sp.simplify(expression.subs(x, point))),
        "secantSlope": str(secant),
        "limitAtZero": str(slope_limit),
        "slopeAtPoint": float(slope_at_point),
        "checks": checks,
    }

