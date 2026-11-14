---
name: luminalearn-video-studio
description: Create or revise verified LuminaLearn math-video treatments, storyboards, previews, and QA artifacts without bypassing teacher approval or mathematical verification.
---

# LuminaLearn video studio

Use this workflow for changes to a LuminaLearn educational math video.

1. Inspect `MathVisualizationSpecV2`, `mathematicalClaims`, the verification proof, and the current artifact version before proposing visuals. Treat teacher-approved content as immutable unless the user explicitly requests a draft revision.
2. Select only a registered style from `VISUAL_STYLE_REGISTRY` and a registered math template. Use `EducationalFilmDirector` to produce the typed treatment; never replace verified claims with a free-text style prompt.
3. Choose motion from `@luminalearn/animation`: `ConceptTitleReveal`, `StepFormulaReveal`, or `BeforeAfterComparison`. Use Manim for verified mathematical geometry and Remotion for presentation.
4. Keep display text, narration text, and subtitles separate. Any mathematical edit requires full SymPy reverification and a new approval snapshot.
5. Validate relevant Zod contracts and run targeted package typechecks/tests. For a visual change, render representative frames or a contact sheet and inspect the actual output. Do not claim frame QA from source review alone.
6. Report the selected style/components, locked claim IDs, test results, preview paths, visual-QA status, and any OSS provenance affected by the change.

Prefer the read-only LuminaLearn MCP tools for discovery and inspection. They do not authorize edits, external inference, rendering, publishing, or paid API use. Never pass arbitrary paths, secrets, or document contents into MCP tool arguments.

Before handoff, confirm that approval/version integrity remains intact and update `docs/oss-adoption.md` if a new external recipe or asset was introduced.
