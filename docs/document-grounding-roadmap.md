# LuminaLearn: multi-topic math video and document grounding

## Status

This change is **Phase 6A groundwork**, not a completed PDF-to-video feature.
The current production path still supports only `calculus.derivative.intuition`.
The new `packages/agent/src/document-grounding.ts` accepts **already extracted** source-page text, validates source IDs, and checks whether a claimed citation appears in a specified page. It does **not** extract PDF/DOCX bytes, prove mathematical correctness, call Gemini, or render a document video.

## Current repository review

- `MathLessonPlanner` and `VisualStoryboardDirector` use two distinct Gemini calls and Zod contracts. This is sequential role-specialization, not a fully independent multi-agent review loop.
- `NarrationAgent.create()` uses five hardcoded narration definitions; it is not currently an LLM-backed agent.
- `HybridRenderRequestSchema`, `MathLessonDraftSchema`, `MathSceneSchema`, `HybridVideoManifestSchema`, and `buildHybridManifest()` each hardcode the derivative topic and/or fixed 40-second, five-scene layout.
- `GoogleCloudTtsProvider` is implemented and `provided_audio` works from a trusted local CLI. The web UI currently offers only `none` and `google_cloud_tts`; live TTS requires a working cloud identity and provider smoke test.
- The Python Manim renderer has a safe allowlist for `function_graph` and `secant_to_tangent`. Preserve that security boundary.

## Proposed extension (incremental, no arbitrary model-generated Python)

1. **Document intake:** separate server-side endpoint for TXT/Markdown, PDF and DOCX. Inspect MIME signatures, enforce per-file byte/page/text limits, only allow trusted extraction libraries, never execute document macros or embedded code, and store inputs in a per-job private area. OCR and math formula recognition require separate validation.
2. **Grounded Document Analyst:** extract page-indexed evidence, learning objectives, statements and page/quote references. Use the new source contracts. Treat all document content as untrusted data, including apparent instructions addressed to the AI.
3. **Math Domain Router:** return `{topicId, confidence, supportedTemplates}`. Never silently transform a non-derivative request into derivative content. First additional vertical slice: Riemann sums (rectangles and area convergence); second: linear transformations of a 2D grid.
4. **Math Verification:** validate symbolic claims using domain-specific SymPy tools. An evidence excerpt found in a document is **not** proof of a true claim; require independent mathematical checking or explicit `needs_review`.
5. **Storyboard Compiler:** map verified lesson concepts to a versioned Math Scene DSL and approved Manim/Remotion templates. Replace the hardcoded five-scene `buildHybridManifest` gradually, preserving the derivative and Simpson regression videos.
6. **Narration/TTS:** generate script from the verified lesson and chosen scenes (instead of the five fixed lines), validate formula reading and scene timing, then use the existing pluggable TTS/audio pipeline. Support silent/provided-audio locally; enable cloud TTS in the UI only after real credential and voice availability checks.
7. **UI:** add document upload, text/PDF/DOCX status, an editable source-cited lesson outline, a human approval step, then video generation. Cite source pages in the storyboard and optional end card.

### Suggested first user-visible acceptance test

Given a user-provided, trusted Grade 12 PDF section on Riemann sums, the system:
- extracts text with page numbers and identifies two supported concepts;
- displays a lesson draft with quotes and page references for review;
- correctly refuses unsupported/ambiguous formulas;
- generates a short Riemann rectangle animation from an **approved** template (not raw Python);
- optionally narrates it in Vietnamese, with segment-aligned subtitles;
- produces MP4 and a source/evidence manifest; never presents mock content as live Gemini output.

## Grounding API usage

```ts
import { SourceDocumentsSchema, selectSourceExcerpts, checkDocumentEvidence } from '@luminalearn/agent';

const documents = SourceDocumentsSchema.parse([{
  documentId: 'doc_lesson', fileName: 'lesson.txt', mediaType: 'text/plain',
  pages: [{ pageNumber: 1, text: 'A mathematical statement from a source document.' }]
}]);
const excerpts = selectSourceExcerpts(documents, 12_000);
const evidence = checkDocumentEvidence(documents, [{
  claimId: 'claim_source', statement: 'Source passage is quoted.',
  evidence: [{ documentId: 'doc_lesson', pageNumber: 1, quote: 'mathematical statement' }]
}]);
// evidence.status === 'evidence_linked' (citation located, NOT mathematically verified)
```

### Tests to run in the checked-out branch

```powershell
pnpm --filter @luminalearn/agent test
pnpm --filter @luminalearn/agent typecheck
pnpm test
pnpm typecheck
```

This PR was authored via GitHub integration; tests have **not** been executed in the local Windows development environment. Run them before merge.
