from __future__ import annotations

from typing import Any

import sympy as sp

from .safe_expression import UnsafeExpressionError, parse_bounded_expression


class RiemannValidationError(ValueError):
    pass


def _polynomial(coefficients: list[float], x: sp.Symbol) -> sp.Expr:
    return sp.Add(*(sp.Rational(str(coefficient)) * x ** power for power, coefficient in enumerate(coefficients)))


def verify_riemann_scene(scene: dict[str, Any], claims: dict[str, str] | None = None) -> dict[str, Any]:
    if not isinstance(scene, dict):
        raise RiemannValidationError("Scene must be a dictionary")

    topic_id = scene.get("topicId")
    if topic_id != "calculus.integral.riemann_sum":
        raise RiemannValidationError(f"unsupported_topic: expected calculus.integral.riemann_sum, got {topic_id}")

    visualization = scene.get("visualization")
    if visualization != "riemann_sum":
        raise RiemannValidationError(f"unsupported_visualization: expected riemann_sum, got {visualization}")

    # Validate function
    func_data = scene.get("function", {})
    if not isinstance(func_data, dict) or func_data.get("type") != "polynomial":
        raise RiemannValidationError("Only polynomial functions are currently supported for Riemann sums")
    coefficients = func_data.get("coefficients", [])
    if not isinstance(coefficients, list) or len(coefficients) < 2:
        raise RiemannValidationError("Polynomial function must have at least 2 coefficients")

    # Validate interval [a, b]
    interval = scene.get("interval", [0, 1])
    if not isinstance(interval, (list, tuple)) or len(interval) != 2:
        raise RiemannValidationError("Interval must be a 2-element list [a, b]")
    a_val, b_val = float(interval[0]), float(interval[1])
    if a_val >= b_val:
        raise RiemannValidationError(f"Invalid interval: start ({a_val}) must be strictly less than end ({b_val})")

    # Validate partitions
    partitions = scene.get("partitions", [4, 8, 16])
    if not isinstance(partitions, list) or len(partitions) == 0:
        raise RiemannValidationError("Partitions must be a non-empty list of integers")
    for n in partitions:
        if not isinstance(n, int) or n < 1 or n > 1000:
            raise RiemannValidationError(f"Invalid partition count {n}: must be integer between 1 and 1000")

    x, n_sym, i_sym = sp.symbols("x n i", real=True)
    a, b = sp.Rational(str(a_val)), sp.Rational(str(b_val))
    expression = _polynomial(coefficients, x)

    # Calculate exact definite integral: \int_a^b f(x) dx
    definite_integral = sp.integrate(expression, (x, a, b))

    # Calculate symbolic left Riemann sum formula
    # S_n = \sum_{i=0}^{n-1} f(a + i * (b-a)/n) * ((b-a)/n)
    delta_x = (b - a) / n_sym
    xi = a + i_sym * delta_x
    term = expression.subs(x, xi) * delta_x
    symbolic_sum = sp.factor(sp.summation(term, (i_sym, 0, n_sym - 1)))

    # Calculate limit of Riemann sum as n -> \infty
    sum_limit = sp.limit(symbolic_sum, n_sym, sp.oo)

    expected = {
        "integral": definite_integral,
        "definite_integral": definite_integral,
        "riemannSumFormula": symbolic_sum,
        "riemann_sum_formula": symbolic_sum,
        "riemannSumLimit": sum_limit,
        "riemann_sum_limit": sum_limit,
        "limitAtInfinity": sum_limit,
    }

    checks: dict[str, dict[str, Any]] = {}
    status = "verified"

    if claims:
        for key, actual in claims.items():
            if key not in expected:
                checks[key] = {"status": "needs_review", "reason": f"No validator is registered for claim key '{key}'"}
                if status == "verified":
                    status = "needs_review"
                continue

            try:
                claimed = parse_bounded_expression(actual, {"n": n_sym, "x": x})
                target = expected[key]
                verified = sp.simplify(claimed - target) == 0
                checks[key] = {
                    "status": "verified" if verified else "incorrect",
                    "expected": str(target),
                    "received": str(claimed)
                }
                if not verified:
                    status = "incorrect"
            except UnsafeExpressionError as error:
                checks[key] = {"status": "rejected", "reason": str(error)}
                status = "incorrect"

    # Also compute numerical samples for each partition
    sample_values: dict[int, float] = {}
    for p in partitions:
        val = float(symbolic_sum.subs(n_sym, p))
        sample_values[p] = round(val, 6)

    return {
        "status": status,
        "topicId": topic_id,
        "visualization": visualization,
        "expression": str(expression),
        "interval": [a_val, b_val],
        "integral": str(definite_integral),
        "definite_integral": str(definite_integral),
        "riemannSumFormula": str(symbolic_sum),
        "riemann_sum_formula": str(symbolic_sum),
        "limitAtInfinity": str(sum_limit),
        "riemannSumLimit": str(sum_limit),
        "riemann_sum_limit": str(sum_limit),
        "samplePartitions": sample_values,
        "checks": checks,
    }
