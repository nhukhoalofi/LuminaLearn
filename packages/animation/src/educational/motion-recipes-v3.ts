import type { MotionRecipeIdV1 } from '@luminalearn/scene-schema';

export interface MotionRecipeFrameStateV3 {
  progress: number;
  opacity: number;
  translateY: number;
  scale: number;
  activeIndex: number;
  completedCount: number;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const smoothstep = (value: number) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

/** Pure frame-driven state shared by scientific adapters. No randomness or wall-clock input. */
export function deriveMotionRecipeFrameV3(input: {
  recipeId: MotionRecipeIdV1;
  frame: number;
  startFrame?: number;
  endFrame: number;
  itemCount?: number;
}): MotionRecipeFrameStateV3 {
  const start = input.startFrame ?? 0;
  if (!Number.isInteger(input.frame) || !Number.isInteger(start) || !Number.isInteger(input.endFrame) || input.endFrame <= start) throw new Error('motion_recipe_invalid_timing');
  const itemCount = Math.max(1, Math.floor(input.itemCount ?? 1));
  const linear = clamp01((input.frame - start) / Math.max(1, input.endFrame - start - 1));
  const progress = ['R03', 'R04', 'R05', 'R07', 'R08'].includes(input.recipeId) ? smoothstep(linear) : linear;
  const itemPosition = Math.min(itemCount - 1, Math.floor(progress * itemCount));
  const completedCount = progress >= 1 ? itemCount : Math.min(itemCount, Math.floor(progress * itemCount));
  const entrance = smoothstep(Math.min(1, progress * 3));
  return {
    progress,
    opacity: entrance,
    translateY: (1 - entrance) * 18,
    scale: 0.96 + entrance * 0.04,
    activeIndex: itemPosition,
    completedCount
  };
}

export interface BeatFrameWindowV3 {
  beatId: string;
  sceneId: string;
  startFrame: number;
  endFrame: number;
  timingEvidence: 'planned' | 'measured_audio';
}

/** Allocates ordered beats contiguously inside one authoritative scene frame interval. */
export function allocateBeatWindowsV3(input: {
  sceneId: string;
  sceneStartFrame: number;
  sceneEndFrame: number;
  beats: Array<{ beatId: string; preferredFrames: number; minimumFrames: number; maximumFrames: number }>;
  timingEvidence?: 'planned' | 'measured_audio';
}): BeatFrameWindowV3[] {
  const { sceneStartFrame, sceneEndFrame, beats } = input;
  const totalFrames = sceneEndFrame - sceneStartFrame;
  if (totalFrames <= 0 || beats.length === 0) throw new Error('beat_compiler_invalid_scene');
  if (beats.some((beat) => beat.minimumFrames <= 0 || beat.minimumFrames > beat.preferredFrames || beat.preferredFrames > beat.maximumFrames)) throw new Error('beat_compiler_invalid_constraints');
  const minimumTotal = beats.reduce((sum, beat) => sum + beat.minimumFrames, 0);
  if (minimumTotal > totalFrames) throw new Error('beat_compiler_insufficient_frames');
  const weights = beats.map((beat) => Math.max(1, beat.preferredFrames - beat.minimumFrames));
  const remaining = totalFrames - minimumTotal;
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const allocations = beats.map((beat, index) => Math.min(beat.maximumFrames, beat.minimumFrames + Math.floor(remaining * weights[index] / weightTotal)));
  let allocated = allocations.reduce((sum, value) => sum + value, 0);
  for (let index = 0; allocated < totalFrames; index = (index + 1) % allocations.length) {
    if (allocations[index] < beats[index].maximumFrames) { allocations[index] += 1; allocated += 1; }
    else if (allocations.every((value, itemIndex) => value >= beats[itemIndex].maximumFrames)) throw new Error('beat_compiler_excess_frames');
  }
  let cursor = sceneStartFrame;
  return beats.map((beat, index) => {
    const startFrame = cursor;
    const endFrame = startFrame + allocations[index];
    cursor = endFrame;
    return { beatId: beat.beatId, sceneId: input.sceneId, startFrame, endFrame, timingEvidence: input.timingEvidence ?? 'planned' };
  });
}

// --- Specialized Typed Recipe Calculators (Recipes R01, R02, R03, R04, R05, R10) ---

export interface RecipeDescriptorV3 {
  recipeId: MotionRecipeIdV1;
  name: string;
  supportedVisualIntents: readonly string[];
  compatibleSceneTypes: readonly string[];
  minimumFrames: number;
  maximumFrames: number;
  safeFallback: string;
}

export const SCIENTIFIC_RECIPE_DESCRIPTORS_V3: Record<'R01' | 'R02' | 'R03' | 'R04' | 'R05' | 'R10', RecipeDescriptorV3> = {
  R01: {
    recipeId: 'R01',
    name: 'Formula Step Reveal',
    supportedVisualIntents: ['formula_transformation'],
    compatibleSceneTypes: ['formula_derivation', 'algebra_identity'],
    minimumFrames: 12,
    maximumFrames: 240,
    safeFallback: 'static_formula'
  },
  R02: {
    recipeId: 'R02',
    name: 'Semantic Highlight',
    supportedVisualIntents: ['formula_transformation', 'concept_focus'],
    compatibleSceneTypes: ['formula_derivation', 'algebra_identity', 'concept_intro'],
    minimumFrames: 8,
    maximumFrames: 120,
    safeFallback: 'static_badge'
  },
  R03: {
    recipeId: 'R03',
    name: 'Graph Trace',
    supportedVisualIntents: ['graph_and_tangent', 'verified_parameter_step'],
    compatibleSceneTypes: ['graph_plot', 'loss_landscape'],
    minimumFrames: 16,
    maximumFrames: 360,
    safeFallback: 'static_curve'
  },
  R04: {
    recipeId: 'R04',
    name: 'Parameter Motion',
    supportedVisualIntents: ['verified_parameter_step', 'graph_and_tangent'],
    compatibleSceneTypes: ['loss_landscape', 'graph_plot'],
    minimumFrames: 16,
    maximumFrames: 360,
    safeFallback: 'static_marker'
  },
  R05: {
    recipeId: 'R05',
    name: 'Dynamic Tangent',
    supportedVisualIntents: ['graph_and_tangent', 'verified_parameter_step'],
    compatibleSceneTypes: ['graph_plot', 'loss_landscape'],
    minimumFrames: 16,
    maximumFrames: 240,
    safeFallback: 'static_tangent'
  },
  R10: {
    recipeId: 'R10',
    name: 'Worked Example Progression',
    supportedVisualIntents: ['formula_transformation', 'comparison'],
    compatibleSceneTypes: ['formula_derivation', 'algebra_identity'],
    minimumFrames: 24,
    maximumFrames: 720,
    safeFallback: 'full_worked_example_list'
  }
};

/** R01 Formula Reveal: Calculates deterministic opacity & vertical entrance. */
export function deriveFormulaRevealState(input: {
  frame: number;
  durationFrames: number;
  stepIndex?: number;
  totalSteps?: number;
}): { opacity: number; translateY: number; isRevealed: boolean } {
  const duration = Math.max(1, input.durationFrames);
  const normalized = clamp01(input.frame / duration);
  const t = smoothstep(Math.min(1, normalized * 2.5));
  return {
    opacity: t,
    translateY: (1 - t) * 16,
    isRevealed: normalized > 0.05
  };
}

/** R02 Semantic Highlight: Produces pulse/glow intensity for key mathematical terms. */
export function deriveSemanticHighlightState(input: {
  frame: number;
  durationFrames: number;
  termIndex?: number;
}): { pulseScale: number; glowIntensity: number; active: boolean } {
  const duration = Math.max(1, input.durationFrames);
  const normalized = clamp01(input.frame / duration);
  // Two deterministic sine pulses between frame 0.15 and 0.85
  const pulseActive = normalized >= 0.15 && normalized <= 0.85;
  const pulseFactor = pulseActive ? Math.sin((normalized - 0.15) / 0.7 * Math.PI * 2) : 0;
  return {
    pulseScale: 1 + Math.max(0, pulseFactor) * 0.08,
    glowIntensity: Math.max(0, pulseFactor) * 0.8,
    active: pulseActive
  };
}

/** R03 Graph Trace: Computes progressive SVG path reveal clipping. */
export function deriveGraphTraceState(input: {
  frame: number;
  durationFrames: number;
}): { traceProgress: number; isComplete: boolean } {
  const duration = Math.max(1, input.durationFrames);
  const linear = clamp01(input.frame / duration);
  const traceProgress = smoothstep(linear);
  return {
    traceProgress,
    isComplete: traceProgress >= 0.999
  };
}

/** R04 Parameter Motion: Computes interpolated scalar parameter between scientific states. */
export function deriveParameterMotionState(input: {
  frame: number;
  durationFrames: number;
  startParam: number;
  endParam: number;
}): { currentParam: number; progress: number } {
  const duration = Math.max(1, input.durationFrames);
  const progress = smoothstep(clamp01(input.frame / duration));
  const currentParam = input.startParam + (input.endParam - input.startParam) * progress;
  return {
    currentParam,
    progress
  };
}

/** R05 Dynamic Tangent: Computes tangent reveal opacity & slope indicator visibility. */
export function deriveDynamicTangentState(input: {
  frame: number;
  durationFrames: number;
  tangentX: number;
  slope: number;
}): { opacity: number; showSlopeLabel: boolean; label: string } {
  const duration = Math.max(1, input.durationFrames);
  const progress = smoothstep(clamp01(input.frame / duration));
  return {
    opacity: progress,
    showSlopeLabel: progress > 0.4,
    label: `f'(${input.tangentX}) = ${input.slope.toFixed(2)}`
  };
}

/** R10 Worked Example Progression: Allocates discrete step indices across total duration. */
export function deriveWorkedExampleProgressionState(input: {
  frame: number;
  durationFrames: number;
  stepCount: number;
}): { activeIndex: number; progress: number; completedCount: number } {
  const count = Math.max(1, input.stepCount);
  const duration = Math.max(1, input.durationFrames);
  const progress = clamp01(input.frame / duration);
  const activeIndex = Math.min(count - 1, Math.floor(progress * count));
  const completedCount = progress >= 1 ? count : Math.min(count, Math.floor(progress * count));
  return {
    activeIndex,
    progress,
    completedCount
  };
}


