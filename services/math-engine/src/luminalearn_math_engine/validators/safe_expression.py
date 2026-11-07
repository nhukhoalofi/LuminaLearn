from __future__ import annotations

import ast
from typing import Mapping

import sympy as sp


class UnsafeExpressionError(ValueError):
    pass


def parse_bounded_expression(source: str, symbols: Mapping[str, sp.Symbol]) -> sp.Expr:
    """Parse arithmetic only; calls, attributes, indexing, and names outside the allowlist fail."""
    if len(source) > 120:
        raise UnsafeExpressionError("Expression is too long")
    normalized = source.replace("^", "**")
    try:
        root = ast.parse(normalized, mode="eval")
    except SyntaxError as error:
        raise UnsafeExpressionError("Invalid arithmetic expression") from error

    def convert(node: ast.AST, depth: int = 0) -> sp.Expr:
        if depth > 12:
            raise UnsafeExpressionError("Expression is too deeply nested")
        if isinstance(node, ast.Expression):
            return convert(node.body, depth + 1)
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)) and not isinstance(node.value, bool):
            return sp.Rational(str(node.value))
        if isinstance(node, ast.Name) and node.id in symbols:
            return symbols[node.id]
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
            value = convert(node.operand, depth + 1)
            return value if isinstance(node.op, ast.UAdd) else -value
        if isinstance(node, ast.BinOp) and isinstance(node.op, (ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Pow)):
            left, right = convert(node.left, depth + 1), convert(node.right, depth + 1)
            if isinstance(node.op, ast.Pow):
                if not right.is_integer or abs(int(right)) > 8:
                    raise UnsafeExpressionError("Exponent must be an integer from -8 to 8")
                return left ** right
            if isinstance(node.op, ast.Add): return left + right
            if isinstance(node.op, ast.Sub): return left - right
            if isinstance(node.op, ast.Mult): return left * right
            if right == 0: raise UnsafeExpressionError("Division by zero")
            return left / right
        raise UnsafeExpressionError(f"Forbidden expression element: {type(node).__name__}")

    return convert(root)

