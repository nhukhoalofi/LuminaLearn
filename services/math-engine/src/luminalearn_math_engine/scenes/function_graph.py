from __future__ import annotations

from manim import Create, Dot, FadeIn, Scene, Text, VGroup, DOWN, UP

from .common import BLUE, CYAN, VIOLET, brand_header, build_axes, load_scene_config, polynomial_value


class FunctionGraphScene(Scene):
    def construct(self) -> None:
        self.camera.background_color = "#070B14"
        spec = load_scene_config()
        coefficients = spec["function"]["coefficients"]
        point_x = spec["pointX"]

        header = brand_header("Đồ thị hàm số").to_edge(UP, buff=0.35)
        axes = build_axes().shift(UP * 0.25)
        graph = axes.plot(lambda value: polynomial_value(coefficients, value), x_range=[-2, 3], color=BLUE, stroke_width=5)
        point = Dot(axes.c2p(point_x, polynomial_value(coefficients, point_x)), color=VIOLET, radius=0.09)
        point_label = Text(f"P tại x = {point_x:g}", font="Arial", font_size=24, color=VIOLET).next_to(point, direction=[1, 1, 0], buff=0.12)
        formula = Text("f(x) = x²", font="Arial", font_size=30, color=CYAN).to_edge(DOWN, buff=0.55)

        self.play(FadeIn(header), run_time=0.5)
        self.play(Create(axes), FadeIn(axes.labels), run_time=1.2)
        self.play(Create(graph), run_time=1.4)
        self.play(FadeIn(VGroup(point, point_label, formula)), run_time=0.8)
        self.wait(max(0.5, spec["durationSeconds"] - 3.9))

