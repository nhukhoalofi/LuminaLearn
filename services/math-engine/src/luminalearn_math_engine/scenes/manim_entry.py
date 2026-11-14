from manim import config

# Manim's logical frame is landscape by default even when pixel resolution is portrait.
# Set the mathematical coordinate frame before Scene instances are constructed.
config.frame_width = config.frame_height * config.pixel_width / config.pixel_height

from luminalearn_math_engine.scenes.function_graph import FunctionGraphScene as _FunctionGraphScene
from luminalearn_math_engine.scenes.secant_to_tangent import SecantToTangentScene as _SecantToTangentScene
from luminalearn_math_engine.scenes.riemann_sum import RiemannSumScene as _RiemannSumScene


class FunctionGraphScene(_FunctionGraphScene):
    pass


class SecantToTangentScene(_SecantToTangentScene):
    pass


class RiemannSumScene(_RiemannSumScene):
    pass


__all__ = ["FunctionGraphScene", "SecantToTangentScene", "RiemannSumScene"]
