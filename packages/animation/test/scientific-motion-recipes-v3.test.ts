import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  allocateBeatWindowsV3,
  deriveDynamicTangentState,
  deriveFormulaRevealState,
  deriveGraphTraceState,
  deriveMotionRecipeFrameV3,
  deriveParameterMotionState,
  deriveSemanticHighlightState,
  deriveWorkedExampleProgressionState,
  SCIENTIFIC_RECIPE_DESCRIPTORS_V3
} from '../src/educational/motion-recipes-v3';

describe('Quality Sprint B deterministic scientific motion recipes', () => {
  it('produces byte-stable frame state for all implemented recipes', () => {
    for (const recipeId of ['R01', 'R02', 'R03', 'R04', 'R05', 'R07', 'R08', 'R10'] as const) {
      const first = deriveMotionRecipeFrameV3({ recipeId, frame: 24, startFrame: 0, endFrame: 96, itemCount: 4 });
      const second = deriveMotionRecipeFrameV3({ recipeId, frame: 24, startFrame: 0, endFrame: 96, itemCount: 4 });
      assert.deepEqual(first, second, recipeId);
      assert.ok(first.progress >= 0 && first.progress <= 1);
    }
  });

  it('keeps ordered beat windows contiguous with no overlap or gap', () => {
    const windows = allocateBeatWindowsV3({ sceneId: 'scene_graph', sceneStartFrame: 120, sceneEndFrame: 360, timingEvidence: 'planned', beats: [
      { beatId: 'show_curve', minimumFrames: 48, preferredFrames: 72, maximumFrames: 120 },
      { beatId: 'show_tangent', minimumFrames: 48, preferredFrames: 96, maximumFrames: 192 }
    ] });
    assert.equal(windows[0].startFrame, 120);
    assert.equal(windows[0].endFrame, windows[1].startFrame);
    assert.equal(windows[1].endFrame, 360);
    assert.ok(windows.every((window) => window.timingEvidence === 'planned'));
  });

  it('rejects impossible beat timing instead of overlapping animation', () => {
    assert.throws(() => allocateBeatWindowsV3({ sceneId: 'scene_short', sceneStartFrame: 0, sceneEndFrame: 20, beats: [{ beatId: 'too_long', minimumFrames: 24, preferredFrames: 30, maximumFrames: 40 }] }), /insufficient_frames/);
  });

  it('computes deterministic specialized states for six priority motion recipes', () => {
    // R01 Formula Reveal
    const r01 = deriveFormulaRevealState({ frame: 12, durationFrames: 24 });
    assert.ok(r01.opacity >= 0 && r01.opacity <= 1);
    assert.ok(r01.translateY >= 0);

    // R02 Semantic Highlight
    const r02 = deriveSemanticHighlightState({ frame: 12, durationFrames: 24 });
    assert.ok(r02.pulseScale >= 1);

    // R03 Graph Trace
    const r03 = deriveGraphTraceState({ frame: 24, durationFrames: 48 });
    assert.ok(r03.traceProgress >= 0 && r03.traceProgress <= 1);

    // R04 Parameter Motion
    const r04 = deriveParameterMotionState({ frame: 20, durationFrames: 40, startParam: 1.0, endParam: 3.0 });
    assert.ok(r04.currentParam >= 1.0 && r04.currentParam <= 3.0);

    // R05 Dynamic Tangent
    const r05 = deriveDynamicTangentState({ frame: 20, durationFrames: 24, tangentX: 1, slope: 2 });
    assert.equal(r05.label, "f'(1) = 2.00");
    assert.equal(r05.showSlopeLabel, true);

    // R10 Worked Example Progression
    const r10 = deriveWorkedExampleProgressionState({ frame: 30, durationFrames: 60, stepCount: 3 });
    assert.equal(r10.activeIndex, 1);
    assert.equal(r10.completedCount, 1);

    // Verify descriptors exist and meet constraints
    assert.equal(SCIENTIFIC_RECIPE_DESCRIPTORS_V3.R01.recipeId, 'R01');
    assert.equal(SCIENTIFIC_RECIPE_DESCRIPTORS_V3.R10.recipeId, 'R10');
  });
});

