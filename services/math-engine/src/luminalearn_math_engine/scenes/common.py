from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from manim import Axes, Text, VGroup, WHITE

BACKGROUND = "#070B14"
CYAN = "#22D3EE"
BLUE = "#38BDF8"
VIOLET = "#A78BFA"
AMBER = "#FBBF24"
MUTED = "#94A3B8"


def load_scene_config() -> dict[str, Any]:
    path = os.environ.get("LUMINA_MATH_SCENE_PATH")
    if not path:
        raise RuntimeError("LUMINA_MATH_SCENE_PATH is required")
    return json.loads(Path(path).read_text(encoding="utf-8"))


def polynomial_value(coefficients: list[float], value: float) -> float:
    return sum(coefficient * value ** power for power, coefficient in enumerate(coefficients))


def polynomial_derivative_value(coefficients: list[float], value: float) -> float:
    return sum(power * coefficient * value ** (power - 1) for power, coefficient in enumerate(coefficients) if power > 0)


def build_axes() -> Axes:
    axes = Axes(
        x_range=[-2, 4, 1], y_range=[-1, 9, 1], x_length=4.0, y_length=5.2,
        axis_config={"color": MUTED, "stroke_width": 2, "include_ticks": True, "include_numbers": False},
        tips=False,
    )
    labels = axes.get_axis_labels(
        Text("x", font="Arial", font_size=24, color=WHITE),
        Text("y", font="Arial", font_size=24, color=WHITE),
    )
    axes.labels = labels
    return axes


def brand_header(title: str) -> VGroup:
    brand = Text("LuminaLearn", font="Arial", font_size=26, weight="BOLD", color=CYAN)
    heading = Text(title, font="Arial", font_size=19, weight="BOLD", color=WHITE)
    return VGroup(brand, heading).arrange(direction=[0, -1, 0], buff=0.18)

