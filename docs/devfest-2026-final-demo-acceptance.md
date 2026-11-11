# LuminaLearn V3 — DevFest 2026 Release-Blocker Review (Sprint B.4.1)

**Repository:** `nhukhoalofi/LuminaLearn`  
**Branch:** `feat/v3-quality-sprint-b-verified-motion`  
**Reviewed HEAD:** `a7465c56eacb412f1a2f7faf1b44a87382b6a7fb`
**Decision:** `CONDITIONAL_GO` for the local, pre-rendered three-video demo; **not** a production release approval.

## Scope and verification authority

This release candidate contains exactly three DevFest compositions: Algebra Identity (48s), Derivative / Secant to Tangent (52s), and Gradient Descent (52s).

The following statuses are deliberately separate:

1. **Formal SymPy verification** applies only to a formula or transformation for which a trusted formal result exists.
2. **Deterministic numeric validation** applies to the Gradient Descent trace bound to the current claim. It is not a SymPy proof and does not create a `proofRecordId`.
3. **Teacher approval** freezes an approved version and its content hash; it does not itself prove each displayed formula.
4. **Pre-rendered compositions** are local fixtures registered in the Remotion worker. They are not evidence that a live Teacher Studio request generated the same artifact.
5. **CI acceptance** is independent from local targeted tests.

## B.4.1 blocker fixes

- Production validation no longer invents the fixed trace `L(w)=(w-2)^2+1`. A storyboard-derived trace is mandatory, must have the same `claimId`, and must pass the bounded quadratic loss, analytic gradient, and parameter-update checks. Missing traces require human review; invalid or cross-claim traces are rejected.
- The supported update expression is bounded to `w_next = w - eta * grad_L(w)` (including normalized LaTeX variants). Missing, arbitrary, identity-only, wrong-sign, or unsupported expressions cannot receive numeric validation.
- Numeric validation stores a SHA-256 trace fingerprint in the validation report. It sets neither `formalExpressionVerified` nor `proofRecordId`.
- Formula-level SymPy badges require a server-issued binding whose scene, claim, approved version, formal status, normalized expression, and trusted fingerprint all match. A client `isVerified` value or reference string is insufficient.
- Formula-step and algebra-identity components without an exact trusted binding show the neutral text `Biến đổi đại số từng bước`.
- Bayes remains `planning_only`; no Bayes render adapter was added.
- The current three-scene planner supports presets through 300 seconds. A 600-second request returns `timeline_insufficient_scene_capacity`; Teacher Studio no longer advertises the unsupported 600-second preset. No generic filler was reintroduced.

## Scientific checks for the three fixtures

- **Algebra:** `(a+b)^2 = a^2 + 2ab + b^2` is represented by four equivalent steps. The area fixture uses coordinates on one shared scale and regions `9, 6, 6, 4`, totaling `25`. The displayed component does not infer a SymPy badge from artifact integrity alone.
- **Derivative:** the fixture uses `f(x)=x^2`, `f'(x)=2x`, and `f'(1)=2`. Both secant endpoints are evaluated on the source function. Motion recipe R04 moves the second point toward `(1,1)` during the 24-second scene; the tangent is visible before and at scene end.
- **Gradient Descent:** `L(w)=(w-2)^2+1`, `η=0.4`, parameters `4 → 2.4 → 2.08 → 2.016`, losses `5 → 1.16 → 1.0064 → 1.000256`, and gradients `4 → 0.8 → 0.16 → 0.032` satisfy the bounded numeric contract. The convergence wording is limited to a convex function with a suitable learning rate. No formal proof record is synthesized.

## Local media audit

FFprobe and SHA-256 were rerun on the physical files on 2026-11-11.

| Local artifact | Duration | Video | Streams | SHA-256 |
| --- | ---: | --- | --- | --- |
| `artifacts/quality-sprint-b/devfest-algebra-identity.mp4` | 48.000s | H.264, 720×1280, 24fps | video only | `1743fb37ae929119dd4a382f8824fa99ab2412b0fca40a58221d8abd1e494840` |
| `artifacts/quality-sprint-b/devfest-derivative-tangent.mp4` | 52.000s | H.264, 720×1280, 24fps | video only | `74945ddc2875cce66cec6689099173d7aa161d931f5c30b14d9786064db10cbf` |
| `artifacts/quality-sprint-b/devfest-gradient-descent.mp4` | 52.000s | H.264, 720×1280, 24fps | video only | `7454d2a244605cf2ec2c5d9022e2ce34987c13a0755d12de304143189875c915` |

All three files are **SUBTITLE_ONLY**: Vietnamese subtitles are burned into the picture; there is no audio stream and no separate subtitle stream. They are local files, not remotely published artifacts. Six stored keyframes (two per video) were visually inspected for blank frames, clipping, formula placement, curve/area geometry, and subtitle readability. No rerender was required because the B.4.1 changes affect verification metadata and fail-closed badge authorization; the registered DevFest fixtures do not supply a trusted proof context.

Reproducible Remotion composition IDs are:

- `DevFestAlgebraIdentityV3`
- `DevFestDerivativeTangentV3`
- `DevFestGradientDescentV3`

## Tests executed in this patch

| Command | Result |
| --- | --- |
| `pnpm --filter @luminalearn/agent typecheck` | PASS |
| `pnpm --filter @luminalearn/animation typecheck` | PASS |
| `pnpm --filter @luminalearn/hybrid-renderer typecheck` | PASS |
| `pnpm --filter @luminalearn/web typecheck` | PASS |
| Agent targeted tests: scientific authority + duration contract + director readiness | PASS, 51/51 |
| Animation trusted proof/badge tests | PASS, 7/7 |
| Graph math + loss motion + scientific motion recipes | PASS, 20/20 |
| Hybrid renderer V3 integrity tests | PASS, 7/7 |
| Three DevFest fixture-contract assertion | PASS |

The first attempt through the package `test` script expanded to `test/*.test.ts`; it was stopped after reproducing the seven 600-second failures. It is not counted as a passing run. Full Agent, full SymPy, full Hybrid Renderer, full monorepo build, MP4 rerenders, and live Gemini/TTS tests are `NOT_RUN` by sprint instruction.

## CI status and decision

- GitHub Actions run `42962460898` for HEAD `a7465c56...` completed with **failure**. Steps through typecheck, Python SymPy, Scene Schema, and Animation passed; `Run Multi-Agent Supervisor tests` failed, so Hybrid Renderer, Web, and production build steps were skipped. The raw job-log endpoint returned HTTP 403 without authentication. The locally reproduced failures were the seven 600-second expectations and Bayes readiness contract described in the review request.
- Previous run `42959423879` also completed with **failure**.
- No candidate CI exists for these uncommitted changes because this patch was not pushed.

Therefore the recommendation remains **CONDITIONAL_GO** for playing the three inspected local MP4s with an explicit subtitle-only label. It is **NO_GO** for production release or a claim of passing candidate CI until the patch is reviewed, pushed by an authorized maintainer, and GitHub Actions passes.
