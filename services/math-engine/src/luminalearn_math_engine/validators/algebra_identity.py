from __future__ import annotations

from typing import Any

import sympy as sp

from .safe_expression import parse_bounded_expression


def verify_algebra_identity(left: str, right: str) -> dict[str, Any]:
    """Verify a bounded two-variable identity without eval/sympify on raw input."""
    a, b = sp.symbols("a b", real=True)
    symbols = {"a": a, "b": b}
    left_expr = parse_bounded_expression(left, symbols)
    right_expr = parse_bounded_expression(right, symbols)
    difference = sp.expand(left_expr - right_expr)
    return {
        "status": "verified" if difference == 0 else "incorrect",
        "left": left,
        "right": right,
        "canonicalDifference": str(difference),
        "verifier": "SymPy expand over allowlisted symbols a,b",
    }

