# Phase 4: Manim + Remotion integration direction

Phase 3 deliberately produces a standalone, deterministic MP4. In Phase 4, copy or expose the verified clip to Remotion's static asset directory, then use Remotion's `<Video>` component inside a scene whose duration is derived from probed media metadata.

Recommended flow:

1. Keep `math-v1` and the verification report as provenance next to the clip.
2. Probe width, height, FPS, duration, codec, and pixel format before composition.
3. Normalize mathematical clips to the Remotion composition's FPS and dimensions.
4. Let Remotion own typography, narration, intro/outro, and the global timeline; let Manim own mathematical geometry.
5. Reject a clip when its verification report is not `verified` or its media metadata differs from the declared spec.

Do not let a generated storyboard choose a Python module or filesystem path. Map the approved visualization identifier to a renderer-owned asset only.

## Implemented local pipeline

`packages/hybrid-renderer` now owns asset probing, path containment, manifest construction, staging, Remotion invocation, final FFmpeg normalization, and final probing. A job writes artifacts under `outputs/<jobId>/`; only the verified Manim clip is copied to `apps/worker/public/generated/<jobId>/` for `staticFile()`.

The 40-second timeline is frame-based: 120 hook frames, the exact probed Manim frame count (193 in the current fixture), then three pedagogical text scenes sharing the remaining frames. The clip is never stretched.

```powershell
cd D:\Hackathon\LuminaLearn
pnpm hybrid:render -- --mode mock
pnpm hybrid:render -- --mode live
pnpm dev:web
```

Live mode requires `GEMINI_API_KEY`; mock mode is explicitly labeled in both manifest and UI. The local Next.js queue runs one job at a time and is intentionally in-memory: restarting the server loses job status. Completed artifacts remain available for preview. Failed jobs remove staged public assets while retaining their output log for diagnosis.

For local cleanup, stop the web server first, then remove old job-specific directories from both `outputs/` and `apps/worker/public/generated/`. Never remove either parent directory while a render is active.
