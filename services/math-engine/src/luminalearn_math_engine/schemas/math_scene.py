from __future__ import annotations

from typing import Any


class MathSceneValidationError(ValueError):
    pass


BASE_KEYS = {
    "schemaVersion", "topicId", "visualization", "function",
    "durationSeconds", "fps", "width", "height",
}
DERIVATIVE_KEYS = {"pointX"}
SECANT_KEYS = {"pointX", "hStart", "hEnd"}
RIEMANN_KEYS = {"interval", "partitions"}


def _number(value: Any, name: str, minimum: float, maximum: float) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise MathSceneValidationError(f"{name} must be a number")
    value = float(value)
    if not minimum <= value <= maximum:
        raise MathSceneValidationError(f"{name} must be between {minimum} and {maximum}")
    return value


def validate_math_scene(data: Any) -> dict[str, Any]:
    if not isinstance(data, dict):
        raise MathSceneValidationError("Math scene must be a JSON object")
    visualization = data.get("visualization")
    if visualization not in {"function_graph", "secant_to_tangent", "riemann_sum"}:
        raise MathSceneValidationError("Visualization template is not allowlisted")

    if visualization == "riemann_sum":
        allowed_keys = BASE_KEYS | RIEMANN_KEYS
    elif visualization == "secant_to_tangent":
        allowed_keys = BASE_KEYS | SECANT_KEYS
    else:
        allowed_keys = BASE_KEYS | DERIVATIVE_KEYS

    unknown = set(data) - allowed_keys
    missing = allowed_keys - set(data)
    if unknown:
        raise MathSceneValidationError(f"Unknown fields are forbidden: {sorted(unknown)}")
    if missing:
        raise MathSceneValidationError(f"Missing required fields: {sorted(missing)}")
    if data["schemaVersion"] != "math-v1":
        raise MathSceneValidationError("schemaVersion must be math-v1")

    if visualization == "riemann_sum":
        if data["topicId"] != "calculus.integral.riemann_sum":
            raise MathSceneValidationError("unsupported_topic")
    else:
        if data["topicId"] != "calculus.derivative.intuition":
            raise MathSceneValidationError("unsupported_topic")

    function = data["function"]
    if not isinstance(function, dict) or set(function) != {"type", "coefficients"}:
        raise MathSceneValidationError("function must contain only type and coefficients")
    if function["type"] != "polynomial":
        raise MathSceneValidationError("Only polynomial functions are supported")
    coefficients = function["coefficients"]
    if not isinstance(coefficients, list) or not 2 <= len(coefficients) <= 6:
        raise MathSceneValidationError("Polynomial must contain 2 to 6 coefficients")
    safe_coefficients = [_number(value, "coefficient", -100, 100) for value in coefficients]
    if safe_coefficients[-1] == 0:
        raise MathSceneValidationError("Highest-order coefficient must be non-zero")

    duration = _number(data["durationSeconds"], "durationSeconds", 1, 20)
    fps = _number(data["fps"], "fps", 12, 60)
    width = _number(data["width"], "width", 360, 1920)
    height = _number(data["height"], "height", 360, 1920)
    if any(value != int(value) for value in (fps, width, height)):
        raise MathSceneValidationError("fps, width, and height must be integers")

    result = {
        **data,
        "function": {"type": "polynomial", "coefficients": safe_coefficients},
        "durationSeconds": duration, "fps": int(fps), "width": int(width), "height": int(height),
    }

    if visualization == "riemann_sum":
        interval = data["interval"]
        if not isinstance(interval, list) or len(interval) != 2:
            raise MathSceneValidationError("interval must be a 2-element list [a, b]")
        a = _number(interval[0], "interval start", -100, 100)
        b = _number(interval[1], "interval end", -100, 100)
        if a >= b:
            raise MathSceneValidationError("interval start must be strictly less than interval end")
        partitions = data["partitions"]
        if not isinstance(partitions, list) or len(partitions) == 0:
            raise MathSceneValidationError("partitions must be a non-empty list of integers")
        safe_partitions = []
        for p in partitions:
            if isinstance(p, bool) or not isinstance(p, int) or p < 1 or p > 1000:
                raise MathSceneValidationError(f"Invalid partition count {p}: must be int between 1 and 1000")
            safe_partitions.append(int(p))
        result.update({"interval": [a, b], "partitions": safe_partitions})
    elif visualization == "secant_to_tangent":
        point_x = _number(data["pointX"], "pointX", -10, 10)
        h_start = _number(data["hStart"], "hStart", 0.05, 5)
        h_end = _number(data["hEnd"], "hEnd", 0.001, 0.5)
        if h_end >= h_start:
            raise MathSceneValidationError("hEnd must be smaller than hStart; h = 0 is forbidden")
        result.update({"pointX": point_x, "hStart": h_start, "hEnd": h_end})
    else:
        point_x = _number(data["pointX"], "pointX", -10, 10)
        result.update({"pointX": point_x})

    return result

