from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
from typing import Any

from .renderer import render_math_scene
from .schemas.math_scene import validate_math_scene
from .validators.derivative import verify_derivative_scene


def _read_json(path: str) -> dict[str, Any]:
    raw = sys.stdin.read() if path == "-" else Path(path).read_text(encoding="utf-8")
    data = json.loads(raw)
    if not isinstance(data, dict): raise ValueError("Input JSON must be an object")
    return data


def _read_claims(path: str | None) -> dict[str, str] | None:
    if path is None:
        return None
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(data, dict) or not all(isinstance(key, str) and isinstance(value, str) for key, value in data.items()):
        raise ValueError("Claims must be a JSON object containing string expressions")
    return data


def main() -> None:
    parser = argparse.ArgumentParser(description="LuminaLearn allowlisted math validation and Manim renderer")
    subparsers = parser.add_subparsers(dest="command", required=True)
    for name in ("validate", "verify"):
        command = subparsers.add_parser(name)
        command.add_argument("input", help="Math Scene JSON file, or - for stdin")
        if name == "verify":
            command.add_argument("--claims", default=None)
    for name in ("render", "pipeline"):
        command = subparsers.add_parser(name)
        command.add_argument("input", help="Math Scene JSON file, or - for stdin")
        command.add_argument("--output-dir", default="output")
        command.add_argument("--timeout", type=int, default=None)
        if name == "pipeline":
            command.add_argument("--claims", default=None)
    args = parser.parse_args()
    try:
        scene = _read_json(args.input)
        if args.command == "validate": result: Any = {"status": "valid", "scene": validate_math_scene(scene)}
        elif args.command == "verify": result = verify_derivative_scene(scene, _read_claims(args.claims))
        elif args.command == "render": result = {"status": "rendered", "output": str(render_math_scene(scene, Path(args.output_dir), args.timeout))}
        else:
            report = verify_derivative_scene(scene, _read_claims(args.claims))
            if report["status"] != "verified": raise ValueError(f"Mathematical verification failed: {report['status']}")
            output = render_math_scene(scene, Path(args.output_dir), args.timeout)
            result = {"status": "rendered", "verification": report, "output": str(output)}
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except Exception as error:
        print(json.dumps({"status": "error", "error": str(error)}, ensure_ascii=False), file=sys.stderr)
        raise SystemExit(2) from error


if __name__ == "__main__":
    main()

