from __future__ import annotations

import numpy as np
from manim import (
    Create, Dot, FadeIn, FadeOut, Line, Scene, Text, Transform, ValueTracker,
    VGroup, always_redraw, linear, DOWN, UP, WHITE,
)

from .common import AMBER, BLUE, CYAN, VIOLET, brand_header, build_axes, load_scene_config, polynomial_derivative_value, polynomial_value


class SecantToTangentScene(Scene):
    def construct(self) -> None:
        self.camera.background_color = "#070B14"
        spec = load_scene_config()
        coefficients = spec["function"]["coefficients"]
        point_x = spec["pointX"]
        point_y = polynomial_value(coefficients, point_x)
        tangent_slope = polynomial_derivative_value(coefficients, point_x)
        h = ValueTracker(spec["hStart"])

        header = brand_header("Từ cát tuyến đến tiếp tuyến").to_edge(UP, buff=0.28)
        axes = build_axes().shift(UP * 0.28)
        graph = axes.plot(lambda value: polynomial_value(coefficients, value), x_range=[-2, 3], color=BLUE, stroke_width=5)
        point_p = Dot(axes.c2p(point_x, point_y), color=VIOLET, radius=0.09)
        label_p = Text("P", font="Arial", font_size=23, color=VIOLET).next_to(point_p, direction=[-1, 1, 0], buff=0.1)

        point_q = always_redraw(lambda: Dot(
            axes.c2p(point_x + h.get_value(), polynomial_value(coefficients, point_x + h.get_value())),
            color=AMBER, radius=0.09,
        ))
        label_q = always_redraw(lambda: Text("Q", font="Arial", font_size=23, color=AMBER).next_to(point_q, direction=[1, 1, 0], buff=0.1))

        def secant_line() -> Line:
            p = axes.c2p(point_x, point_y)
            q = axes.c2p(point_x + h.get_value(), polynomial_value(coefficients, point_x + h.get_value()))
            direction = (q - p) / np.linalg.norm(q - p)
            return Line(p - direction * 1.5, p + direction * 3.5, color=AMBER, stroke_width=4)

        secant = always_redraw(secant_line)
        slope = always_redraw(lambda: Text(
            f"m(h) = {((polynomial_value(coefficients, point_x + h.get_value()) - point_y) / h.get_value()):.2f}",
            font="Arial", font_size=25, color=AMBER
        ).to_edge(DOWN, buff=0.72))

        self.play(FadeIn(header), run_time=0.4)
        self.play(Create(axes), FadeIn(axes.labels), Create(graph), run_time=1.35)
        self.play(FadeIn(VGroup(point_p, label_p)), FadeIn(point_q), FadeIn(label_q), Create(secant), FadeIn(slope), run_time=0.75)
        self.play(h.animate.set_value(spec["hEnd"]), run_time=3.0, rate_func=linear)

        tangent_direction = axes.c2p(point_x + 1, point_y + tangent_slope) - axes.c2p(point_x, point_y)
        tangent_direction = tangent_direction / np.linalg.norm(tangent_direction)
        tangent = Line(
            axes.c2p(point_x, point_y) - tangent_direction * 1.5,
            axes.c2p(point_x, point_y) + tangent_direction * 3.5,
            color=CYAN, stroke_width=5,
        )
        tangent_label = Text(f"Tiếp tuyến: hệ số góc = {tangent_slope:g}", font="Arial", font_size=25, color=CYAN).to_edge(DOWN, buff=0.72)
        self.remove(secant, slope)
        self.play(Create(tangent), FadeIn(tangent_label), FadeOut(point_q), FadeOut(label_q), run_time=0.65)

        concept = Text(
            "Đạo hàm tại một điểm là hệ số góc\ncủa tiếp tuyến tại điểm đó\nkhi đạo hàm tồn tại.",
            font="Arial", font_size=25, color=WHITE, line_spacing=0.9,
        ).scale_to_fit_width(4.0).to_edge(DOWN, buff=0.42)
        self.play(Transform(tangent_label, concept), run_time=0.7)
        self.wait(max(0.3, spec["durationSeconds"] - 6.85))

