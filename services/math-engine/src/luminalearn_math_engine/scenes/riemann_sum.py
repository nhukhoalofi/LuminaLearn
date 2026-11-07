from __future__ import annotations

from manim import (
    Axes, Create, FadeIn, FadeOut, Polygon, Scene, Text, Transform,
    VGroup, DOWN, UP, WHITE,
)

from .common import AMBER, BLUE, CYAN, VIOLET, brand_header, load_scene_config, polynomial_value


class RiemannSumScene(Scene):
    def construct(self) -> None:
        self.camera.background_color = "#070B14"
        spec = load_scene_config()
        coefficients = spec["function"]["coefficients"]
        interval = spec.get("interval", [0.0, 1.0])
        a, b = float(interval[0]), float(interval[1])
        partitions = spec.get("partitions", [4, 8, 16])
        duration = float(spec.get("durationSeconds", 10.0))

        header = brand_header("Tổng Riemann và Tích phân").to_edge(UP, buff=0.28)

        # Coordinate axes for interval [0, 1] without MathTex numbers
        axes = Axes(
            x_range=[-0.2, 1.3, 0.5],
            y_range=[-0.2, 1.4, 0.5],
            x_length=4.2,
            y_length=5.0,
            axis_config={"color": "#94A3B8", "stroke_width": 2, "include_ticks": True, "include_numbers": False},
            tips=False,
        ).shift(UP * 0.28)

        axes_labels = axes.get_axis_labels(
            Text("x", font="Arial", font_size=24, color=WHITE),
            Text("y", font="Arial", font_size=24, color=WHITE),
        )

        x_zero = Text("0", font="Arial", font_size=18, color=WHITE).next_to(axes.c2p(0, 0), direction=[-1, -1, 0], buff=0.1)
        x_one = Text("1", font="Arial", font_size=18, color=WHITE).next_to(axes.c2p(1, 0), direction=[0, -1, 0], buff=0.12)
        y_one = Text("1", font="Arial", font_size=18, color=WHITE).next_to(axes.c2p(0, 1), direction=[-1, 0, 0], buff=0.12)
        axis_marks = VGroup(axes_labels, x_zero, x_one, y_one)

        # Plot curve y = f(x)
        graph = axes.plot(
            lambda x: polynomial_value(coefficients, x),
            x_range=[0.0, 1.15],
            color=CYAN,
            stroke_width=5,
        )
        curve_label = Text("f(x) = x²", font="Arial", font_size=20, color=CYAN).next_to(
            axes.c2p(1.0, 1.0), direction=[1, 0.5, 0], buff=0.15
        )

        def make_rectangles(n: int) -> tuple[VGroup, float]:
            dx = (b - a) / n
            rects = VGroup()
            area = 0.0
            for i in range(n):
                x_left = a + i * dx
                x_right = x_left + dx
                y_val = polynomial_value(coefficients, x_left)
                area += y_val * dx
                if y_val > 0.0001:
                    p1 = axes.c2p(x_left, 0)
                    p2 = axes.c2p(x_right, 0)
                    p3 = axes.c2p(x_right, y_val)
                    p4 = axes.c2p(x_left, y_val)
                    rect = Polygon(
                        p1, p2, p3, p4,
                        stroke_color=AMBER,
                        stroke_width=2,
                        fill_color=VIOLET if n >= 8 else BLUE,
                        fill_opacity=0.6,
                    )
                    rects.add(rect)
            return rects, area

        self.play(FadeIn(header), run_time=0.4)
        self.play(Create(axes), FadeIn(axis_marks), Create(graph), FadeIn(curve_label), run_time=1.2)

        # 1. First partition: n = 4
        n1 = partitions[0] if len(partitions) > 0 else 4
        rects1, area1 = make_rectangles(n1)
        label_stage = Text(
            f"n = {n1}  ⇒  Tổng diện tích: {area1:.2f}",
            font="Arial", font_size=23, color=AMBER
        ).to_edge(DOWN, buff=0.72)

        self.play(Create(rects1), FadeIn(label_stage), run_time=1.0)
        self.wait(1.0)

        # 2. Second partition: n = 8
        n2 = partitions[1] if len(partitions) > 1 else 8
        rects2, area2 = make_rectangles(n2)
        label_stage2 = Text(
            f"n = {n2}  ⇒  Tổng diện tích: {area2:.2f}",
            font="Arial", font_size=23, color=AMBER
        ).to_edge(DOWN, buff=0.72)

        self.play(Transform(rects1, rects2), Transform(label_stage, label_stage2), run_time=1.0)
        self.wait(1.0)

        # 3. Third partition: n = 16
        n3 = partitions[2] if len(partitions) > 2 else 16
        rects3, area3 = make_rectangles(n3)
        label_stage3 = Text(
            f"n = {n3}  ⇒  Tổng diện tích: {area3:.2f}",
            font="Arial", font_size=23, color=AMBER
        ).to_edge(DOWN, buff=0.72)

        self.play(Transform(rects1, rects3), Transform(label_stage, label_stage3), run_time=1.0)
        self.wait(1.0)

        # 4. Smooth integral area & final limit
        # Build polygon for area under curve from a to b
        area_points = [axes.c2p(a, 0)]
        step_count = 30
        for s in range(step_count + 1):
            px = a + (b - a) * s / step_count
            py = polynomial_value(coefficients, px)
            area_points.append(axes.c2p(px, py))
        area_points.append(axes.c2p(b, 0))

        smooth_area = Polygon(
            *area_points,
            stroke_width=0,
            fill_color=CYAN,
            fill_opacity=0.55
        )

        conclusion = Text(
            "Khi n tiến ra vô cùng (n → ∞):\nDiện tích = Tích phân = 1/3 ≈ 0.333",
            font="Arial", font_size=23, color=WHITE, line_spacing=0.9
        ).scale_to_fit_width(4.2).to_edge(DOWN, buff=0.45)

        self.play(FadeOut(rects1), FadeIn(smooth_area), Transform(label_stage, conclusion), run_time=1.2)

        remaining_time = max(0.5, duration - 8.0)
        self.wait(remaining_time)
