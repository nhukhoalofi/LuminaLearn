import {
  CompiledPedagogicalAnimationPlanV1Schema,
  type EducationalVisualActionV1,
  type EducationalVisualIntentV1,
  type MotionRecipeIdV1,
  type PedagogicalBeatV1,
  type VisualIntentMappingV1
} from '@luminalearn/scene-schema';

export interface BeatCompilerSceneTimingV3 {
  sceneId: string;
  startFrame: number;
  endFrame: number;
  timingEvidence: 'planned' | 'measured_audio';
}

function recipeForAction(action: EducationalVisualActionV1, intent: EducationalVisualIntentV1): { recipeId?: MotionRecipeIdV1; parameters?: Record<string, unknown> } {
  if (action === 'reveal_formula_step') return { recipeId: 'R01', parameters: { recipe: 'formula_reveal', easing: 'smoothstep' } };
  if (action === 'highlight_term') return { recipeId: 'R02', parameters: { recipe: 'semantic_highlight', pulseCount: 2 } };
  if (action === 'draw_graph') return { recipeId: 'R03', parameters: { recipe: 'graph_trace', traceDurationRatio: 0.8 } };
  if (action === 'move_parameter_marker') return { recipeId: 'R04', parameters: { recipe: 'parameter_motion', interpolation: 'smoothstep' } };
  if (action === 'draw_tangent') return { recipeId: 'R05', parameters: { recipe: 'dynamic_tangent', showSlope: true } };
  if (action === 'trace_signal') return { recipeId: 'R07', parameters: { recipe: 'information_flow', flowMode: 'forward' } };
  if (action === 'reveal_attention_cell') return { recipeId: 'R08', parameters: { recipe: 'matrix_reveal', heatmapShading: true } };
  if (intent === 'formula_transformation' || intent === 'comparison') return { recipeId: 'R10', parameters: { recipe: 'worked_example_progression' } };
  return {};
}

function allocate(totalFrames: number, beats: PedagogicalBeatV1[]): number[] {
  const minimum = beats.map((beat) => beat.timingConstraints.minimumFrames);
  const maximum = beats.map((beat) => beat.timingConstraints.maximumFrames);
  const minimumTotal = minimum.reduce((sum, value) => sum + value, 0);
  const maximumTotal = maximum.reduce((sum, value) => sum + value, 0);
  if (minimumTotal > totalFrames) throw new Error('beat_compiler_insufficient_frames');
  if (maximumTotal < totalFrames) throw new Error('beat_compiler_excess_frames');
  const preferredExtra = beats.map((beat, index) => Math.max(1, beat.timingConstraints.preferredFrames - minimum[index]));
  const preferredTotal = preferredExtra.reduce((sum, value) => sum + value, 0);
  const remaining = totalFrames - minimumTotal;
  const result = minimum.map((value, index) => Math.min(maximum[index], value + Math.floor(remaining * preferredExtra[index] / preferredTotal)));
  let assigned = result.reduce((sum, value) => sum + value, 0);
  while (assigned < totalFrames) {
    const index = result.findIndex((value, itemIndex) => value < maximum[itemIndex]);
    if (index < 0) throw new Error('beat_compiler_excess_frames');
    result[index] += 1;
    assigned += 1;
  }
  return result;
}

/** Compiles approved pedagogical beats into ordered frame cues without changing claims or narration. */
export function compilePedagogicalBeatsV3(input: {
  beats: PedagogicalBeatV1[];
  visualMappings: VisualIntentMappingV1[];
  sceneTimings: BeatCompilerSceneTimingV3[];
  fps: number;
  totalFrames: number;
}) {
  const mappings = new Map(input.visualMappings.map((mapping) => [mapping.visualIntent, mapping]));
  const timings = new Map(input.sceneTimings.map((timing) => [timing.sceneId, timing]));
  const findings: Array<{ code: string; status: 'WARNING' | 'NEEDS_REVIEW' | 'BLOCKED'; message: string; beatId?: string }> = [];
  const cues: Array<Record<string, unknown>> = [];

  for (const timing of input.sceneTimings) {
    const sceneBeats = input.beats.filter((beat) => beat.sceneId === timing.sceneId);
    if (sceneBeats.length === 0) continue;
    const durations = allocate(timing.endFrame - timing.startFrame, sceneBeats);
    let beatStart = timing.startFrame;
    sceneBeats.forEach((beat, beatIndex) => {
      const mapping = mappings.get(beat.visualIntent);
      if (!mapping || mapping.readiness !== 'render_ready' || !mapping.adapterId) {
        findings.push({ code: 'beat_adapter_not_ready', status: 'NEEDS_REVIEW', message: mapping?.reviewReason ?? `No render-ready adapter for '${beat.visualIntent}'.`, beatId: beat.beatId });
        beatStart += durations[beatIndex];
        return;
      }
      const beatEnd = beatStart + durations[beatIndex];
      const actions = beat.recommendedVisualActions;
      const base = Math.floor((beatEnd - beatStart) / actions.length);
      let actionStart = beatStart;
      actions.forEach((action, actionIndex) => {
        const actionEnd = actionIndex === actions.length - 1 ? beatEnd : actionStart + base;
        const recipe = recipeForAction(action, beat.visualIntent);
        cues.push({
          cueId: `${beat.beatId}_cue_${actionIndex + 1}`,
          beatId: beat.beatId,
          sceneId: beat.sceneId,
          visualIntent: beat.visualIntent,
          action,
          conceptOrClaimIds: beat.conceptOrClaimIds,
          scientificDataReferences: beat.workedExampleReferences.length > 0 ? beat.workedExampleReferences : beat.conceptOrClaimIds,
          adapterId: mapping.adapterId,
          startFrame: actionStart,
          endFrame: actionEnd,
          timingEvidence: timing.timingEvidence,
          ...(recipe.recipeId ? { motionRecipeId: recipe.recipeId } : {}),
          ...(recipe.parameters ? { animationParameters: recipe.parameters } : {})
        });
        actionStart = actionEnd;
      });
      beatStart = beatEnd;
    });
  }

  input.beats.forEach((beat) => {
    if (!timings.has(beat.sceneId)) findings.push({ code: 'beat_scene_timing_missing', status: 'BLOCKED', message: `No authoritative timing for scene '${beat.sceneId}'.`, beatId: beat.beatId });
  });
  return CompiledPedagogicalAnimationPlanV1Schema.parse({ schemaVersion: 'pedagogical-animation-plan-v1', fps: input.fps, totalFrames: input.totalFrames, cues, findings });
}

