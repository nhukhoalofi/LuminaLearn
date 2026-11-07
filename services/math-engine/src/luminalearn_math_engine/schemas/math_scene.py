from __future__ import annotations

from typing import Any


class MathSceneValidationError(ValueError):
    pass


BASE_KEYS = {
    "schemaVersion", "topicId", "visualization", "function", "pointX",
    "durationSeconds", "fps", "width", "height",
}
SECANT_KEYS = {"hStart", "hEnd"}


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
    if visualization not in {"function_graph", "secant_to_tangent"}:
        raise MathSceneValidationError("Visualization template is not allowlisted")
    allowed_keys = BASE_KEYS | (SECANT_KEYS if visualization == "secant_to_tangent" else set())
    unknown = set(data) - allowed_keys
    missing = allowed_keys - set(data)
    if unknown:
        raise MathSceneValidationError(f"Unknown fields are forbidden: {sorted(unknown)}")
    if missing:
        raise MathSceneValidationError(f"Missing required fields: {sorted(missing)}")
    if data["schemaVersion"] != "math-v1":
        raise MathSceneValidationError("schemaVersion must be math-v1")
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

    point_x = _number(data["pointX"], "pointX", -10, 10)
    duration = _number(data["durationSeconds"], "durationSeconds", 1, 15)
    fps = _number(data["fps"], "fps", 12, 60)
    width = _number(data["width"], "width", 360, 1920)
    height = _number(data["height"], "height", 360, 1920)
    if any(value != int(value) for value in (fps, width, height)):
        raise MathSceneValidationError("fps, width, and height must be integers")

    result = {
        **data,
        "function": {"type": "polynomial", "coefficients": safe_coefficients},
        "pointX": point_x,
        "durationSeconds": duration, "fps": int(fps), "width": int(width), "height": int(height),
    }
    if visualization == "secant_to_tangent":
        h_start = _number(data["hStart"], "hStart", 0.05, 5)
        h_end = _number(data["hEnd"], "hEnd", 0.001, 0.5)
        if h_end >= h_start:
            raise MathSceneValidationError("hEnd must be smaller than hStart; h = 0 is forbidden")
        result.update({"hStart": h_start, "hEnd": h_end})
    return result

