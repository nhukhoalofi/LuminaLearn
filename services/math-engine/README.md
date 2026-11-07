# LuminaLearn Math Engine (Phase 3)

Deterministic SymPy verification and allowlisted Manim Community rendering. The service accepts bounded `math-v1` JSON data; it never executes code, module names, or script paths from AI output.

## Windows PowerShell setup

```powershell
cd D:\Hackathon\LuminaLearn\services\math-engine
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[test]"
python -m manim checkhealth
python -m pytest
```

FFmpeg must be available on `PATH`. MiKTeX is optional for this Phase 3 scene because it uses Manim `Text`, not `MathTex`.

## Validate, verify, and render

```powershell
python -m luminalearn_math_engine.cli validate .\examples\derivative.scene.json
python -m luminalearn_math_engine.cli verify .\examples\derivative.scene.json
python -m luminalearn_math_engine.cli pipeline .\examples\derivative.scene.json --output-dir .\output --timeout 300
Get-Content .\examples\derivative.scene.json | python -m luminalearn_math_engine.cli validate -
```

Only `function_graph` and `secant_to_tangent` are renderable in Phase 3. Render output and Manim intermediates are gitignored.

## Full mock AI pipeline

From the repository root:

```powershell
corepack pnpm --filter @luminalearn/agent generate -- --render
```

For a live smoke test, copy `.env.example` to `.env`, set `GEMINI_API_KEY`, then run:

```powershell
corepack pnpm --filter @luminalearn/agent smoke:live
```

