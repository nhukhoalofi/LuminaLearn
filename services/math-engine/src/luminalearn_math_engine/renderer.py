from __future__ import annotations

import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from typing import Any

from .schemas.math_scene import validate_math_scene

SCENE_CLASSES = {"function_graph": "FunctionGraphScene", "secant_to_tangent": "SecantToTangentScene"}


class RenderError(RuntimeError):
    pass


def render_math_scene(scene: dict[str, Any], output_directory: Path, timeout_seconds: int | None = None) -> Path:
    safe = validate_math_scene(scene)
    output_directory = output_directory.resolve()
    output_directory.mkdir(parents=True, exist_ok=True)
    media_directory = output_directory / "_manim"
    output_name = f"{safe['topicId'].replace('.', '-')}-{safe['visualization']}"
    entry = Path(__file__).parent / "scenes" / "manim_entry.py"
    timeout = timeout_seconds or min(360, max(90, int(safe["durationSeconds"] * 25)))

    config_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", encoding="utf-8", delete=False) as handle:
            json.dump(safe, handle, ensure_ascii=False)
            config_path = Path(handle.name)
        environment = os.environ.copy()
        environment["LUMINA_MATH_SCENE_PATH"] = str(config_path)
        command = [
            sys.executable, "-m", "manim", "render", "--format=mp4", "--renderer=cairo",
            "--disable_caching", "--verbosity=WARNING", "-r", f"{safe['width']},{safe['height']}",
            "--fps", str(safe["fps"]), "--media_dir", str(media_directory), "-o", output_name,
            str(entry), SCENE_CLASSES[safe["visualization"]],
        ]
        result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", errors="replace", env=environment, timeout=timeout, shell=False)
        if result.returncode != 0:
            raise RenderError(f"Manim failed with exit code {result.returncode}:\n{result.stdout}\n{result.stderr}")
        candidates = list(media_directory.rglob(f"{output_name}.mp4"))
        if not candidates:
            raise RenderError("Manim reported success but no MP4 was found")
        final_path = output_directory / f"{output_name}.mp4"
        shutil.copy2(candidates[0], final_path)
        return final_path
    except subprocess.TimeoutExpired as error:
        raise RenderError(f"Manim render exceeded the {timeout}-second limit") from error
    finally:
        if config_path is not None:
            config_path.unlink(missing_ok=True)

