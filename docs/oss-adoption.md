# Open-source adoption and provenance

LuminaLearn uses the reviewed source commits below as design references. The three Shotcraft components are independent implementations of documented recipes; no demo fixture, font, image, music, or stock asset was copied. Opuscar contributes methodology and style principles, not application source code or media.

| Original project | Source | Reviewed commit | Exact reference | License | LuminaLearn adaptation | Destination | Proof |
|---|---|---|---|---|---|---|---|
| Video Shotcraft | [GitHub](https://github.com/Vincentwei1021/video-shotcraft) | `1266a3ec4831289c4d893d42dd5102723658039a` | `references/shots/typography/brace-expand.md`; `demos/typography/brace-expand/BraceExpand.tsx` | Apache-2.0 | Independently implemented delimiter expansion with one bounded overshoot, hold, vertical safe area, Vietnamese text, and reduced-motion path. | `packages/animation/src/ConceptTitleReveal.tsx` | Production `LuminaDynamicV2` intro; visual regression still; motion tests. |
| Video Shotcraft | [GitHub](https://github.com/Vincentwei1021/video-shotcraft) | `1266a3ec4831289c4d893d42dd5102723658039a` | `references/shots/typography/type-assembly-moves.md` | Apache-2.0 | Independently implemented duration-aware staggered formula assembly for mathematical notation. | `packages/animation/src/StepFormulaReveal.tsx` | Production formula scenes; motion tests. |
| Video Shotcraft | [GitHub](https://github.com/Vincentwei1021/video-shotcraft) | `1266a3ec4831289c4d893d42dd5102723658039a` | `references/shots/data/before-after-slider-scrub.md`; corresponding demo | Apache-2.0 | Independently implemented fast declaration, slower scrub, and final hold with typed React nodes and reduced-motion midpoint. | `packages/animation/src/BeforeAfterComparison.tsx` | Exported approved treatment component; motion tests. |
| Lemo-Opuscar | [GitHub](https://github.com/lemomo-ai/lemo-opuscar) | `bc0992ae25f63c1780dd9cfe39a020e2deda79ec` | `DIRECTOR.md`, `TECHNIQUE.md`, `plugin/skills/lemo-opuscar/SKILL.md` | MIT | Adapted treatment-first direction into a typed, deterministic lesson objective → shot list → verified storyboard flow. Mathematical claims remain teacher-approved and locked. | `packages/agent/src/orchestration/educational-film-director.ts`; `packages/scene-schema/src/v2/visual-style.ts` | Educational film director tests and orchestration context artifact. |
| Lemo-Opuscar | [GitHub](https://github.com/lemomo-ai/lemo-opuscar) | `bc0992ae25f63c1780dd9cfe39a020e2deda79ec` | `styles/chalkboard/STYLE.md`, `styles/dataviz/STYLE.md` | MIT | Adapted clean-slate/limited-chalk/flat-camera and one-idea/data-truthfulness principles into two typed visual styles. | `packages/scene-schema/src/v2/visual-style.ts` | Schema typecheck and director tests. |
| Lemo-Opuscar | [GitHub](https://github.com/lemomo-ai/lemo-opuscar) | `bc0992ae25f63c1780dd9cfe39a020e2deda79ec` | Frame/contact-sheet QA methodology in `TECHNIQUE.md` | MIT | Added representative-frame contact sheets, FFmpeg black-frame inspection, deterministic subtitle/layout checks, media metadata, audio, and duration checks. Semantic frame review remains `requires_manual_review` until an external reviewer confirms it. | `packages/hybrid-renderer/src/visual-qa.ts` | Every successful V2 job emits `contact-sheet.png` and `visual-qa-report.json`; deterministic failures fail the job. |

The upstream copyright and license terms remain with their respective authors. LuminaLearn does not redistribute either upstream repository or any separately licensed media asset.

---

## Technical Breakdown for Mentor Review

### 1. Video Shotcraft (`Vincentwei1021/video-shotcraft`, Apache-2.0) — Motion Choreography Adaptation
- **Code vs. Recipe Reuse**: **100% recipe/choreography adaptation, 0% copied source or assets**. All three components in `packages/animation/src/` are written from scratch in TypeScript/Remotion and bounded by `durationBoundedFrame(rawFrame, durationInFrames)` so animations never overflow scene boundaries.
- **`ConceptTitleReveal`** (`packages/animation/src/ConceptTitleReveal.tsx`):
  - **Upstream Recipe**: `references/shots/typography/brace-expand.md` (delimiter expansion with single overshoot, hold, and clean exit).
  - **LuminaLearn Adaptation**: Uses Remotion `spring({ damping: 16, stiffness: 120, mass: 0.9 })` clamped to `safeExpansion <= 1.08` across a vertical 9:16 safe area (`padding: '110px 54px 210px'`), dynamically scaling font size (`43px` vs `50px`) for long Vietnamese mathematical titles and supporting `reducedMotion`.
- **`StepFormulaReveal`** (`packages/animation/src/StepFormulaReveal.tsx`):
  - **Upstream Recipe**: `references/shots/typography/type-assembly-moves.md` (split/staggered typographic assembly).
  - **LuminaLearn Adaptation**: Computes duration-adaptive stagger (`stagger = clamp(floor(durationInFrames / (formulas.length + 2)), 4, 14)`) so multi-step algebraic derivations (e.g., secant slope simplification or Riemann sum limit) enter sequentially with a `30px -> 0px` vertical slide and highlight the concluding formula in `accentColor`.
- **`BeforeAfterComparison`** (`packages/animation/src/BeforeAfterComparison.tsx`):
  - **Upstream Recipe**: `references/shots/data/before-after-slider-scrub.md` (3-phase choreography: fast declaration fling -> brief hold -> slow analytical scrub).
  - **LuminaLearn Adaptation**: Splits scene duration into `flingEnd (20%)`, `holdEnd (38%)`, and `scrubEnd (72%)`, scrubbing `clipPath: inset(0 ${100 - position}% 0 0)` from `12% -> 76% -> 70% -> 42%` to contrast coarse vs. fine partitions or secant vs. tangent states, with a deterministic `50%` midpoint when `reducedMotion` is enabled.

### 2. Lemo-Opuscar (`lemomo-ai/lemo-opuscar`, MIT) — Direction, Style & Visual QA Methodology
- **Code vs. Methodology Reuse**: **100% architectural methodology and style constraints, 0% copied code or media**.
- **Deterministic Film Direction (`EducationalFilmDirector`)** (`packages/agent/src/orchestration/educational-film-director.ts`):
  - **Upstream Principle**: `DIRECTOR.md` & `TECHNIQUE.md` treatment-first workflow (`Objective -> Treatment -> Shot List -> Render`).
  - **LuminaLearn Adaptation**: Unlike free-form generative video prompts that risk mutating formulas, `EducationalFilmDirector.createTreatment()` is a deterministic pass over SymPy-verified content (`contentAuthority: 'teacher_approved_lesson'`). It refuses to run if any claim is unverified and maps each storyboard scene to an explicit `approvedComponent` (`concept_title_reveal`, `manim_verified_clip`, `step_formula_reveal`, or `before_after_comparison`) while locking `lockedClaimIds`.
- **Typed Visual Style Registry (`VISUAL_STYLE_REGISTRY`)** (`packages/scene-schema/src/v2/visual-style.ts`):
  - **Upstream Principle**: `styles/chalkboard/STYLE.md` (clean slate per concept, limited chalk palette, flat camera) and `styles/dataviz/STYLE.md` (one idea per scene, truthful scale, clear hierarchy).
  - **LuminaLearn Adaptation**: Encodes `math_chalkboard` (`#102A24` slate, `#F5F1DF` chalk, `#F2C94C` gold accent, min body font `26px`, safe padding `48px`) and `clean_educational_infographic` (`#070B14` dark canvas, `#F8FAFC` foreground, `#22D3EE` cyan accent, min body font `25px`, safe padding `48px`) as frozen Zod-validated contracts exposed to both the Web UI and MCP server.
- **Automated + Honest Visual QA (`createVisualQaReport`)** (`packages/hybrid-renderer/src/visual-qa.ts`):
  - **Upstream Principle**: Contact-sheet frame sampling and post-render verification in `TECHNIQUE.md`.
  - **LuminaLearn Adaptation**: Every V2 render extracts a 4-frame `contact-sheet.png` via FFmpeg, runs `blackdetect` across the full timeline, checks subtitle bounding boxes against Manim/formula regions (`subtitle_formula_overlap`), validates font sizes (`>= 24px`) and margins (`>= 32px`), and verifies audio/video duration parity. Crucially, `sampled_frames` remains `requires_manual_review` (`passed: false, requiresManualReview: true`) until a human reviewer explicitly signs off—never faking semantic visual inspection.
